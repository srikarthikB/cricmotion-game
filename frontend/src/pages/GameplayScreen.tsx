import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '../stores/useGameStore';
import { apiService } from '../services/apiService';
import { BallResultResponse, PredictShotResponse } from '../types';
import { Pause, Target, Zap, Activity, Shield, Users, Camera, RefreshCw, Sparkles, Award } from 'lucide-react';

export const GameplayScreen = () => {
  const setState = useGameStore((state) => state.setState);
  const score = useGameStore((state) => state.score);
  const updateScore = useGameStore((state) => state.updateScore);
  const backendMatch = useGameStore((state) => state.backendMatch);

  // Audio Synthesizer helper for sound effects (Crisp & realistic Web Audio)
  const playAudioEffect = (type: 'HIT' | 'WICKET' | 'SWOOSH' | 'CROWD_ROAR') => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'HIT') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(480, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.12);
        
        gain.gain.setValueAtTime(0.7, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
      } else if (type === 'WICKET') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.35);
        
        gain.gain.setValueAtTime(0.8, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else if (type === 'SWOOSH') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 0.18);
        
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'CROWD_ROAR') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, ctx.currentTime);
        osc.frequency.setValueAtTime(110, ctx.currentTime + 0.5);
        
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);
        osc.start();
        osc.stop(ctx.currentTime + 1.2);
      }
    } catch (e) {
      console.warn("Audio Synthesizer is pending user interaction or unsupported.", e);
    }
  };

  // Assets and paths
  const cricketBg = new URL('../assets/images/cricket_pitch_view_1779289157758.png', import.meta.url).href;
  const backupBg = "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&q=80&w=1200";

  // References
  const videoRef = useRef<HTMLVideoElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const screenContainerRef = useRef<HTMLDivElement>(null);

  // Bowler & Delivery States
  const [bowlerState, setBowlerState] = useState<'IDLE' | 'RUNNING' | 'DELIVERING' | 'RELEASED'>('IDLE');
  const [bowlerScale, setBowlerScale] = useState(0.25);
  const [bowlerY, setBowlerY] = useState(0); 
  const [bowlerArmRotation, setBowlerArmRotation] = useState(0);
  const [selectedDelivery, setSelectedDelivery] = useState<'FAST' | 'MEDIUM' | 'SPIN'>('FAST');
  const [spinType, setSpinType] = useState<'OFFBREAK' | 'LEGSPIN'>('OFFBREAK');

  // Ball states
  const [ballState, setBallState] = useState<'IDLE' | 'RELEASED' | 'HIT' | 'BOWLED' | 'DOT'>('IDLE');
  const [ballProgress, setBallProgress] = useState(0); 
  const [lastShot, setLastShot] = useState<{ runs: number; timing: string; type: string } | null>(null);
  const [swingState, setSwingState] = useState<'IDLE' | 'SWINGING' | 'RECOVERING'>('IDLE');

  // Interactive Bat Coordination (driven by temporary webcam motion data)
  const [batPosition, setBatPosition] = useState({ x: 50, y: 70 }); // percentages
  const [targetAngle, setTargetAngle] = useState(0); // aim angle based on bat offset

  // Motion analysis states
  const [motionLevel, setMotionLevel] = useState(0);
  const [isMotionEnabled] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<'BOOTING' | 'ACTIVE' | 'ERROR'>('BOOTING');
  const [motionTriggered, setMotionTriggered] = useState(false);
  const [poseCentroid, setPoseCentroid] = useState<{ x: number; y: number } | null>(null);
  const [poseJoints, setPoseJoints] = useState<{ x: number; y: number }[]>([]);
  const isResolvingBallRef = useRef(false);

  const buildPosePayload = () => {
    if (poseJoints.length > 0) {
      return poseJoints.map((joint) => ({
        x: joint.x / 32,
        y: joint.y / 24,
        z: 0,
      }));
    }

    return [
      {
        x: batPosition.x / 100,
        y: batPosition.y / 100,
        z: 0,
      },
    ];
  };

  const formatPredictionLabel = (value: string) => (
    value
      .replace(/_/g, ' ')
      .trim()
      .toUpperCase()
  );

  const getBackendShotPrediction = async (): Promise<PredictShotResponse | null> => {
    if (!backendMatch) return null;

    try {
      return await apiService.predictShot(backendMatch.gameId, buildPosePayload());
    } catch (err) {
      console.error('Shot prediction failed:', err);
      return null;
    }
  };

  const getTemporaryBallInput = (prediction?: PredictShotResponse | null) => ({
    shot: prediction?.shot || 'unknown',
    timing: prediction?.timing || 'miss',
  });

  const applyBackendBallResult = (result: BallResultResponse) => {
    updateScore({
      runs: result.score,
      wickets: result.wickets,
      balls: result.balls_played,
      overProgress: result.overs.toFixed(1),
      currentOver: [...score.currentOver, result.wicket ? -1 : result.runs],
      target: result.target,
    });
  };

  const submitBackendBallResult = async (
    prediction?: PredictShotResponse | null
  ): Promise<BallResultResponse | null> => {
    if (!backendMatch) return null;

    const ballInput = getTemporaryBallInput(prediction);

    try {
      const result = await apiService.submitBallResult(
        backendMatch.gameId,
        ballInput.shot,
        ballInput.timing
      );
      applyBackendBallResult(result);
      return result;
    } catch (err) {
      console.error('Backend ball result failed:', err);
      return null;
    }
  };

  const finishIfBackendEnded = (result: BallResultResponse) => {
    if (result.status === 'ended' || result.balls_left <= 0) {
      setTimeout(() => setState('SUMMARY'), 2500);
    }
  };

  // Setup Web Camera
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let isCancelled = false;

    async function setupCamera() {
      if (!isMotionEnabled) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 320, height: 240, facingMode: 'user' } 
        });
        if (isCancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        activeStream = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraStatus('ACTIVE');
          videoRef.current.play().catch(playErr => {
            console.warn("Video play triggered user action required:", playErr);
          });
        }
      } catch (e) {
        console.warn("Camera narrow constraints failure, attempting fallback:", e);
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
            video: true 
          });
          if (isCancelled) {
            fallbackStream.getTracks().forEach(track => track.stop());
            return;
          }
          activeStream = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            setCameraStatus('ACTIVE');
            videoRef.current.play().catch(() => {});
          }
        } catch (err) {
          console.error("Camera access failed entirely:", err);
          setCameraStatus('ERROR');
        }
      }
    }

    if (isMotionEnabled) {
      // Small timeout to give DOM paint time to mount the video tag
      const timer = setTimeout(() => {
        setupCamera();
      }, 50);
      return () => {
        isCancelled = true;
        clearTimeout(timer);
        if (activeStream) {
          activeStream.getTracks().forEach(track => track.stop());
        }
      };
    } else {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    }
  }, [isMotionEnabled]);

  // Motion & Dynamic Live Pose Detection Hook
  useEffect(() => {
    let intervalId: any;
    if (isMotionEnabled) {
      intervalId = setInterval(() => {
        if (!videoRef.current || !hiddenCanvasRef.current) return;
        const ctx = hiddenCanvasRef.current.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(videoRef.current, 0, 0, 32, 24);
        try {
          const imgData = ctx.getImageData(0, 0, 32, 24);
          const data = imgData.data;

          if (prevFrameDataRef.current) {
            let diffSum = 0;
            let sumX = 0;
            let sumY = 0;
            let motionCount = 0;
            const threshold = 35; // sensitivity threshold for detection

            for (let y = 0; y < 24; y++) {
              for (let x = 0; x < 32; x++) {
                const idx = (y * 32 + x) * 4;
                const rDiff = Math.abs(data[idx] - prevFrameDataRef.current[idx]);
                const gDiff = Math.abs(data[idx + 1] - prevFrameDataRef.current[idx + 1]);
                const bDiff = Math.abs(data[idx + 2] - prevFrameDataRef.current[idx + 2]);
                const diff = (rDiff + gDiff + bDiff) / 3;
                diffSum += diff;

                if (diff > threshold) {
                  // Mirror x since video input is inverted
                  const mx = 31 - x;
                  sumX += mx;
                  sumY += y;
                  motionCount++;
                }
              }
            }

            const avgDiff = diffSum / (data.length / 4);
            setMotionLevel(avgDiff);

            // Centroid calculations for interactive live posture tracking
            if (motionCount > 4) {
              const cx = sumX / motionCount;
              const cy = sumY / motionCount;
              setPoseCentroid({ x: cx, y: cy });

              // Build cyber skeletal nodes
              setPoseJoints([
                { x: cx, y: cy }, // core
                { x: cx, y: cy - 3.5 }, // head center
                { x: cx - 4, y: cy + 1 }, // left hand
                { x: cx + 4, y: cy + 2 }, // right hand
                { x: cx - 2, y: cy + 6 }, // left leg
                { x: cx + 2, y: cy + 6 }  // right leg
              ]);

              // Smoothly map pose parameters into the 1st person strike area coordinate space
              // map cx (0 to 32) to percentage range (15 to 85)
              let mappedX = 15 + (cx / 32) * 70;
              // map cy (0 to 24) to percentage range (60 to 92)
              let mappedY = 60 + (cy / 24) * 32;

              mappedX = Math.max(15, Math.min(85, mappedX));
              mappedY = Math.max(60, Math.min(92, mappedY));

              setBatPosition({ x: mappedX, y: mappedY });
              setTargetAngle((mappedX - 50) * 1.5);
            }

            if (avgDiff > 28 && !motionTriggered && ballState === 'RELEASED') {
              setMotionTriggered(true);
              swingBat();
            }
          }
          prevFrameDataRef.current = data;
        } catch (err) {
          // Handled silently
        }
      }, 60);
    }
    return () => {
      clearInterval(intervalId);
      setPoseCentroid(null);
      setPoseJoints([]);
    };
  }, [isMotionEnabled, ballState, motionTriggered]);

  // Bowler run-up ticker
  useEffect(() => {
    let runTimer: any;
    if (bowlerState === 'RUNNING') {
      let runProgress = 0;
      runTimer = setInterval(() => {
        runProgress += 4;
        
        setBowlerScale(0.25 + (runProgress / 100) * 0.45);
        setBowlerY(Math.sin((runProgress / 100) * Math.PI * 10) * 6);

        if (runProgress >= 100) {
          clearInterval(runTimer);
          setBowlerState('DELIVERING');
          
          let rot = 0;
          const armTimer = setInterval(() => {
            rot += 36;
            setBowlerArmRotation(rot);
            if (rot >= 360) {
              clearInterval(armTimer);
              setBowlerState('RELEASED');
              setBallState('RELEASED');
              setBallProgress(0);
              setMotionTriggered(false);
              playAudioEffect('SWOOSH');
            }
          }, 25);
        }
      }, 50);
    }
    return () => clearInterval(runTimer);
  }, [bowlerState]);

  // Ball Delivery Physics Loop
  useEffect(() => {
    let ballTimer: any;
    if (ballState === 'RELEASED') {
      const step = selectedDelivery === 'FAST' ? 3.4 : selectedDelivery === 'MEDIUM' ? 2.5 : 1.8;
      
      ballTimer = setInterval(() => {
        setBallProgress((prev) => {
          const next = prev + step;
          if (next >= 104) {
            clearInterval(ballTimer);
            handleDotOrWicket();
            return 104;
          }
          return next;
        });
      }, 16);
    }
    return () => clearInterval(ballTimer);
  }, [ballState, selectedDelivery]);

  // Face next ball trigger, now driven by the match loop instead of UI buttons.
  const faceNextBall = () => {
    if (bowlerState !== 'IDLE' && bowlerState !== 'RELEASED') return;
    
    const deliveryTypes: ('FAST' | 'MEDIUM' | 'SPIN')[] = ['FAST', 'MEDIUM', 'SPIN'];
    const delivery = deliveryTypes[Math.floor(Math.random() * deliveryTypes.length)];
    setSelectedDelivery(delivery);
    
    if (delivery === 'SPIN') {
      setSpinType(Math.random() > 0.5 ? 'OFFBREAK' : 'LEGSPIN');
    }

    setLastShot(null);
    setBallProgress(0);
    setBallState('IDLE');
    setBowlerState('RUNNING');
    setBowlerScale(0.25);
    setBowlerY(0);
    setBowlerArmRotation(0);
    setMotionTriggered(false);
  };

  useEffect(() => {
    if (!backendMatch) return;
    if (bowlerState === 'RUNNING' || bowlerState === 'DELIVERING' || ballState === 'RELEASED') return;

    const delay = ballState === 'IDLE' && score.balls === 0 ? 800 : 2200;
    const timer = window.setTimeout(() => {
      faceNextBall();
    }, delay);

    return () => window.clearTimeout(timer);
  }, [backendMatch, bowlerState, ballState, score.balls]);

  // Evaluate swing outcome
  const swingBat = async () => {
    if (swingState !== 'IDLE' || isResolvingBallRef.current) return;
    
    setSwingState('SWINGING');
    playAudioEffect('SWOOSH');

    setTimeout(() => setSwingState('RECOVERING'), 300);
    setTimeout(() => setSwingState('IDLE'), 500);

    if (ballState === 'RELEASED') {
      isResolvingBallRef.current = true;
      const prediction = await getBackendShotPrediction();
      const predictedShot = prediction ? formatPredictionLabel(prediction.shot) : 'PREDICTION UNAVAILABLE';
      const predictedTiming = prediction ? formatPredictionLabel(prediction.timing) : 'UNKNOWN';
      const timing = ballProgress;
      let shotTiming = predictedTiming;
      let shotType = predictedShot;

      // Match the horizontal alignment of the bat with the ball (X tracking accuracy)
      const horizontalMatch = Math.abs(batPosition.x - 50) < 18;

      if (!horizontalMatch) {
        const result = await submitBackendBallResult({ shot: 'unknown', confidence: 0, timing: 'miss' });
        const runs = result?.runs || 0;
        setLastShot({ runs, timing: 'MISS', type: 'BEATEN FOR WIDTH' });
        setBallState('DOT');
        if (result) finishIfBackendEnded(result);
        isResolvingBallRef.current = false;
        return;
      }

      if (timing >= 82 && timing <= 91) {
        playAudioEffect('HIT');
        playAudioEffect('CROWD_ROAR');
        setBallState('HIT');
      } else if ((timing >= 74 && timing < 82) || (timing > 91 && timing <= 96)) {
        playAudioEffect('HIT');
        setBallState('HIT');
      } else if (timing >= 64 && timing < 74) {
        setBallState('HIT');
      } else if (timing > 96 && timing <= 101) {
        setBallState('HIT');
      } else {
        isResolvingBallRef.current = false;
        return;
      }

      const result = await submitBackendBallResult(prediction);
      if (!result) {
        isResolvingBallRef.current = false;
        return;
      }

      if (result.runs > 0) playAudioEffect('HIT');
      if (result.runs >= 4) playAudioEffect('CROWD_ROAR');
      if (result.wicket) playAudioEffect('WICKET');

      setLastShot({ runs: result.runs, timing: shotTiming, type: shotType });
      setBallState(result.wicket ? 'BOWLED' : result.runs > 0 ? 'HIT' : 'DOT');
      finishIfBackendEnded(result);
      isResolvingBallRef.current = false;
    }
  };

  // Handle dot or bowled if ball goes untouched
  const handleDotOrWicket = async () => {
    if (!backendMatch || isResolvingBallRef.current) return;

    isResolvingBallRef.current = true;
    const result = await submitBackendBallResult({ shot: 'unknown', confidence: 0, timing: 'miss' });

    if (!result) {
      isResolvingBallRef.current = false;
      return;
    }

    if (result.wicket) {
      playAudioEffect('WICKET');
      setBallState('BOWLED');
      setLastShot({ runs: result.runs, timing: 'MISS', type: 'CLEAN BOWLED' });
    } else {
      setBallState('DOT');
      setLastShot({ runs: result.runs, timing: 'MISS', type: 'DEFENDED / BEATEN' });
    }

    finishIfBackendEnded(result);
    isResolvingBallRef.current = false;
  };

  useEffect(() => {
    if (!backendMatch) {
      setState('MATCH_SETTINGS');
    }
  }, [backendMatch, setState]);

  if (!backendMatch) return null;

  const totalOvers = backendMatch.overs;
  const target = backendMatch.target;
  const totalBalls = totalOvers * 6;
  const ballsLeft = Math.max(0, totalBalls - score.balls);
  
  const motionStatus = cameraStatus === 'ERROR'
    ? 'CAMERA UNAVAILABLE'
    : motionLevel > 28
      ? 'SWING DETECTED'
      : ballState === 'RELEASED'
        ? 'WAITING FOR SWING...'
        : 'TRACKING STANCE';

  const motionStatusColor = cameraStatus === 'ERROR'
    ? 'text-rose-400'
    : motionLevel > 28
      ? 'text-emerald-400'
      : 'text-[#00f2ff]';

  // Compute Ball position for visual rendering (parabolic physics)
  const ballVisuals = () => {
    if (ballState !== 'RELEASED') return { top: '44%', left: '50%', scale: 0.05, opacity: 0 };
    
    const progress = ballProgress;
    let horizontalLeft = 50;
    if (selectedDelivery === 'SPIN') {
      if (progress > 55) {
        const factor = (progress - 55) / 45;
        const breakFactor = spinType === 'OFFBREAK' ? -10 : 10;
        horizontalLeft = 50 + breakFactor * factor;
      }
    } else {
      horizontalLeft = 50 + Math.sin((progress / 100) * Math.PI) * 1.5;
    }

    const baseTop = 44 + (progress / 100) * 44; 

    let bounceAltitude = 0;
    if (selectedDelivery === 'FAST') {
      if (progress < 50) {
        const t = progress / 50;
        bounceAltitude = 14 * (1 - t * t);
      } else {
        const t = (progress - 50) / 50;
        bounceAltitude = 20 * (t - t * t);
      }
    } else if (selectedDelivery === 'MEDIUM') {
      if (progress < 45) {
        const t = progress / 45;
        bounceAltitude = 16 * (1 - t * t);
      } else {
        const t = (progress - 45) / 55;
        bounceAltitude = 22 * (t - t * t);
      }
    } else { // SPIN
      if (progress < 55) {
        const t = progress / 55;
        bounceAltitude = 12 * (1 - t * t);
      } else {
        const t = (progress - 55) / 45;
        bounceAltitude = 16 * (t - t * t);
      }
    }

    const finalTop = baseTop - bounceAltitude;
    const finalScale = 0.05 + (progress / 100) * 2.2;
    const shadowOffset = bounceAltitude * 1.6;

    return {
      top: `${finalTop}%`,
      left: `${horizontalLeft}%`,
      scale: finalScale,
      shadowTop: `${baseTop + 1.5}%`,
      shadowLeft: `${horizontalLeft}%`,
      shadowScale: 0.05 + (progress / 100) * 1.2,
      shadowOpacity: 0.5 - (shadowOffset / 80),
      opacity: 1
    };
  };

  const ballPos = ballVisuals();

  return (
    <div 
      id="gameplay_container"
      ref={screenContainerRef}
      className="flex-1 flex flex-col relative bg-black overflow-hidden font-sans select-none touch-none"
    >
      {/* 1. STADIUM BACKGROUND (Batsman POV perspective looking downstream) */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <img 
          src={cricketBg} 
          onError={(e) => {
            (e.target as HTMLImageElement).src = backupBg;
          }}
          alt="Cricket Stadium Pitch visual" 
          className="w-full h-full object-cover scale-105 filter brightness-95"
        />
        
        {/* Dynamic Volumetric Stadium Floodlights */}
        {/* Left Floodlight Tower Cone */}
        <div 
          className="absolute top-0 left-0 w-[45%] h-[90%] bg-gradient-to-br from-cyan-400/15 via-cyan-400/[0.02] to-transparent"
          style={{ clipPath: 'polygon(0 0, 10% 0, 100% 100%, 0 80%)' }}
        />
        {/* Right Floodlight Tower Cone */}
        <div 
          className="absolute top-0 right-0 w-[45%] h-[90%] bg-gradient-to-bl from-cyan-400/15 via-cyan-400/[0.02] to-transparent"
          style={{ clipPath: 'polygon(100% 0, 90% 0, 0 100%, 100% 80%)' }}
        />

        {/* Ambient Stadium center glow */}
        <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-[70%] h-[35%] bg-blue-500/[0.04] rounded-full blur-[90px]" />

        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/35" />
      </div>

      <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] max-w-4xl z-40 pointer-events-none">
        <div className="bg-neutral-950/80 backdrop-blur-md border border-white/10 rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.45)] px-4 py-3 md:px-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-end gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.28em] text-[#00f2ff]/70 italic">Score</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl md:text-6xl font-black text-white tracking-tight leading-none">{score.runs}</span>
                  <span className="text-2xl md:text-3xl font-black text-white/45 leading-none">/ {score.wickets}</span>
                </div>
              </div>
              <div className="pb-1 text-xs md:text-sm font-black uppercase tracking-widest text-white/55">
                {score.overProgress} ov
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 md:min-w-[330px]">
              <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2">
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-white/35">Target</p>
                <p className="text-xl font-black text-white leading-tight">{target}</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2">
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-white/35">Left</p>
                <p className="text-xl font-black text-[#00f2ff] leading-tight">{ballsLeft}</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2">
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-white/35">Ball</p>
                <p className="text-sm font-black text-white uppercase leading-tight">{selectedDelivery}</p>
              </div>
            </div>
          </div>

          <div className="mt-3 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-[#00f2ff] to-emerald-400"
              animate={{ width: `${Math.min(100, (score.balls / totalBalls) * 100)}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>

      {/* 3. SIMULATION VIEWPORT & ANIMATED ENTITIES */}
      <div className="relative flex-1 flex flex-col items-center justify-center z-10 pointer-events-none mt-20">
        
        {/* Pitch lanes guidance boundaries */}
        <div className="absolute inset-x-0 bottom-[22%] h-28 bg-emerald-400/[0.015] transform -skew-x-12 border-y border-emerald-400/5 z-0" />

        {/* A. CYBER BOWLER ANIMATION CANVAS (Standing/Running down pitch) */}
        <div className="absolute top-[32%] w-32 h-32 flex items-end justify-center z-10 transition-transform duration-100 ease-out"
          style={{ 
            transform: `scale(${bowlerScale}) translateY(${bowlerY}px)`
          }}
        >
          <svg className="w-full h-full overflow-visible" viewBox="0 0 100 100">
            <defs>
              <linearGradient id="wicket-grad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="50%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>
              <linearGradient id="skin-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fed7aa" />
                <stop offset="100%" stopColor="#fdbb2d" />
              </linearGradient>
            </defs>
            
            {/* Wickets Far End */}
            <g opacity={bowlerState === 'RUNNING' ? 0.35 : 0.85}>
              <line x1="44" y1="90" x2="44" y2="55" stroke="url(#wicket-grad)" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="50" y1="90" x2="50" y2="55" stroke="url(#wicket-grad)" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="56" y1="90" x2="56" y2="55" stroke="url(#wicket-grad)" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="42" y1="55" x2="58" y2="55" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
            </g>

            {/* Bowler limbs */}
            {bowlerState !== 'RELEASED' && (
              <g className="transition-all duration-75">
                {/* Ground Shadow */}
                <ellipse cx="50" cy="94" rx="14" ry="4" fill="black" fillOpacity="0.4" />
                
                {/* Legs (Running animation stance path) */}
                <g stroke="#ffffff" strokeWidth="6.5" strokeLinecap="round">
                  {/* Left Leg running stance */}
                  <line 
                    x1="45" 
                    y1="52" 
                    x2={bowlerState === 'RUNNING' ? `${42 + Math.sin((bowlerY / 6) * Math.PI) * 7}` : "43"} 
                    y2={bowlerState === 'RUNNING' ? `${74 + Math.cos((bowlerY / 6) * Math.PI) * 3}` : "74"} 
                    stroke="#ffffff"
                  />
                  {/* Right Leg running stance */}
                  <line 
                    x1="55" 
                    y1="52" 
                    x2={bowlerState === 'RUNNING' ? `${58 - Math.sin((bowlerY / 6) * Math.PI) * 7}` : "57"} 
                    y2={bowlerState === 'RUNNING' ? `${74 - Math.cos((bowlerY / 6) * Math.PI) * 3}` : "74"} 
                    stroke="#f1f5f9"
                  />
                  {/* Lower Left Knee to foot */}
                  <line 
                    x1={bowlerState === 'RUNNING' ? `${42 + Math.sin((bowlerY / 6) * Math.PI) * 7}` : "43"} 
                    y1={bowlerState === 'RUNNING' ? `${74 + Math.cos((bowlerY / 6) * Math.PI) * 3}` : "74"} 
                    x2={bowlerState === 'RUNNING' ? `${40 + Math.sin((bowlerY / 6) * Math.PI) * 11}` : "42"} 
                    y2="92" 
                    stroke="#ffffff"
                  />
                  {/* Lower Right Knee to foot */}
                  <line 
                    x1={bowlerState === 'RUNNING' ? `${58 - Math.sin((bowlerY / 6) * Math.PI) * 7}` : "57"} 
                    y1={bowlerState === 'RUNNING' ? `${74 - Math.cos((bowlerY / 6) * Math.PI) * 3}` : "74"} 
                    x2={bowlerState === 'RUNNING' ? `${60 - Math.sin((bowlerY / 6) * Math.PI) * 11}` : "58"} 
                    y2="92" 
                    stroke="#f1f5f9"
                  />
                </g>

                {/* Shoes */}
                <circle cx={bowlerState === 'RUNNING' ? `${40 + Math.sin((bowlerY / 6) * Math.PI) * 11}` : "42"} cy="92" r="3.2" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
                <circle cx={bowlerState === 'RUNNING' ? `${60 - Math.sin((bowlerY / 6) * Math.PI) * 11}` : "58"} cy="92" r="3.2" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1" />

                {/* White Shorts/Trousers hip */}
                <path d="M 40 52 L 60 52 L 57 66 L 43 66 Z" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1" />

                {/* Torso Sport Shirt */}
                <path d="M40,28 L60,28 L57,53 L43,53 Z" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
                
                {/* V-Neck Collar */}
                <path d="M46,28 L50,33 L54,28" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" />

                {/* Head, Cap, Hair */}
                <circle cx="50" cy="18" r="6" fill="url(#skin-grad)" />
                <path d="M44,18 Q50,11 56,18 Z" fill="#1e293b" />
                <path d="M44,16 Q50,11 56,16 Z" fill="#ef4444" />
                <line x1="50" y1="15" x2="57" y2="17" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />

                {/* Left Arm Swinging */}
                <line 
                  x1="40" 
                  y1="30" 
                  x2={bowlerState === 'RUNNING' ? `${33 - Math.sin((bowlerY / 6) * Math.PI) * 8}` : "34"} 
                  y2={bowlerState === 'RUNNING' ? `${42 + Math.cos((bowlerY / 6) * Math.PI) * 4}` : "44"} 
                  stroke="#ffffff" 
                  strokeWidth="4.5" 
                  strokeLinecap="round" 
                />
                <circle 
                  cx={bowlerState === 'RUNNING' ? `${33 - Math.sin((bowlerY / 6) * Math.PI) * 8}` : "34"} 
                  cy={bowlerState === 'RUNNING' ? `${42 + Math.cos((bowlerY / 6) * Math.PI) * 4}` : "44"} 
                  r="2" 
                  fill="url(#skin-grad)" 
                />

                {/* Right Arm swinging & releasing ball */}
                {bowlerState === 'DELIVERING' ? (
                  <g style={{ transform: `rotate(${bowlerArmRotation}deg)`, transformOrigin: '50px 28px' }}>
                    <line x1="50" y1="28" x2="50" y2="4" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" />
                    <circle cx="50" cy="4" r="2.8" fill="url(#skin-grad)" />
                    <circle cx="50" cy="2" r="3.2" fill="#ef4444" className="animate-pulse" />
                  </g>
                ) : (
                  <g>
                    <line 
                      x1="60" 
                      y1="30" 
                      x2={bowlerState === 'RUNNING' ? `${67 + Math.sin((bowlerY / 6) * Math.PI) * 8}` : "66"} 
                      y2={bowlerState === 'RUNNING' ? `${42 - Math.cos((bowlerY / 6) * Math.PI) * 4}` : "44"} 
                      stroke="#ffffff" 
                      strokeWidth="4.5" 
                      strokeLinecap="round" 
                    />
                    <circle 
                      cx={bowlerState === 'RUNNING' ? `${67 + Math.sin((bowlerY / 6) * Math.PI) * 8}` : "66"} 
                      cy={bowlerState === 'RUNNING' ? `${42 - Math.cos((bowlerY / 6) * Math.PI) * 4}` : "44"} 
                      r="2" 
                      fill="url(#skin-grad)" 
                    />
                    <circle 
                      cx={bowlerState === 'RUNNING' ? `${67 + Math.sin((bowlerY / 6) * Math.PI) * 8}` : "66"} 
                      cy={bowlerState === 'RUNNING' ? `${44 - Math.cos((bowlerY / 6) * Math.PI) * 4}` : "46"} 
                      r="3" 
                      fill="#ef4444" 
                    />
                  </g>
                )}
              </g>
            )}
          </svg>

          {bowlerState === 'RUNNING' && (
            <div className="absolute -top-7 bg-emerald-950/95 text-emerald-400 border border-emerald-400/30 px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest animate-pulse">
              RUNNING IN...
            </div>
          )}
          {bowlerState === 'DELIVERING' && (
            <div className="absolute -top-7 bg-red-950/95 text-red-400 border border-red-400/30 px-3 py-1 rounded text-[8px] font-black uppercase tracking-widest animate-bounce">
              BOWLING NOW!
            </div>
          )}
        </div>

        {/* B. CRICKET BALL MOTION SIMULATOR (Red leather neon shadow path) */}
        {ballState === 'RELEASED' && (
          <>
            {/* Turf Shadow */}
            <div 
              className="absolute pointer-events-none rounded-full bg-black/60 blur-[3px]"
              style={{
                top: ballPos.shadowTop,
                left: ballPos.shadowLeft,
                width: `${12 * (ballPos.scale as number)}px`,
                height: `${4 * (ballPos.scale as number)}px`,
                transform: 'translate(-50%, -50%)',
                opacity: ballPos.shadowOpacity
              }}
            />
            {/* Spinning ball container */}
            <div 
              className="absolute pointer-events-none z-20"
              style={{ 
                top: ballPos.top,
                left: ballPos.left,
                transform: `translate(-50%, -50%) scale(${ballPos.scale})`,
                opacity: ballPos.opacity
              }}
            >
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-800 rounded-full border border-red-950 flex items-center justify-center relative shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}
                  className="w-full h-[3px] bg-white opacity-90 absolute rounded-full"
                />
                <div className="absolute top-1 left-1.5 w-3 h-3 bg-white/40 rounded-full" />
              </div>
            </div>
          </>
        )}

        {/* Contact Sweet Spot Target Ring */}
        <div className="absolute bottom-[20%] w-36 h-10 bg-[#00f2ff]/5 rounded-full border border-[#00f2ff]/20 flex items-center justify-center">
          <motion.div 
            animate={{ 
              scale: ballState === 'RELEASED' && ballProgress > 70 ? [1, 1.3, 1] : 1, 
              opacity: ballState === 'RELEASED' && ballProgress > 70 ? [0.4, 0.8, 0.4] : 0.2 
            }}
            transition={{ repeat: Infinity, duration: 0.8 }}
            className={`w-28 h-5 rounded-full blur-sm transition-colors ${ballState === 'RELEASED' && ballProgress >= 82 && ballProgress <= 91 ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-[#00f2ff]'}`}
          />
          {ballState === 'RELEASED' && ballProgress >= 82 && ballProgress <= 91 && (
            <span className="absolute text-[8px] font-black text-emerald-400 animate-bounce bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
              STRIKE ZONE!
            </span>
          )}
        </div>

        {/* Interactive Responsive 3D-Stance Batsman Model */}
        <div 
          className="absolute pointer-events-none z-25 transition-all duration-75 ease-out"
          style={{
            left: `${batPosition.x}%`,
            top: `${batPosition.y + 11}%`, // Lower/mid body crease anchoring
            transform: `translate(-50%, -50%) scale(${0.85 + (batPosition.y / 150)})`,
          }}
        >
          {/* Detailed SVG depicting a professional batsman from behind holding the bat */}
          <svg className="w-48 h-64 overflow-visible" viewBox="0 0 120 160">
            {/* Dynamic Turf pitch shadow */}
            <ellipse cx="60" cy="148" rx="28" ry="6" fill="black" fillOpacity="0.45" />
            
            <g className="transition-all duration-100 ease-out">
              {/* Left foot leg & protection guard pad */}
              <line 
                x1="45" y1="105" 
                x2="44" y2="144" 
                stroke="#f1f5f9" 
                strokeWidth="7" 
                strokeLinecap="round" 
              />
              <path d="M41,108 h6 v28 h-6 Z" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />
              <line x1="44" y1="144" x2="38" y2="147" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" /> {/* Shoe */}

              {/* Right foot leg & protection guard pad (shifts during active stroke) */}
              <line 
                x1="75" y1="105" 
                x2={swingState === 'SWINGING' ? "85" : "76"} 
                y2="144" 
                stroke="#f1f5f9" 
                strokeWidth="7" 
                strokeLinecap="round" 
              />
              <path d="M72,108 h6 v28 h-6 Z" fill="#cbd5e1" stroke="#334155" strokeWidth="1" />
              <line x1="75" y1="144" x2="81" y2="147" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" /> {/* Shoe */}

              {/* Protective athletic trousers and white hips */}
              <path d="M40,86 C40,86 60,91 80,86 L76,110 L44,110 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
              <line x1="44" y1="98" x2="76" y2="98" stroke="#475569" strokeWidth="2" opacity="0.3" />

              {/* White Jersey Torso + Dynamic body waist tilt */}
              <g style={{ 
                transform: swingState === 'SWINGING' ? 'rotate(10deg) translate(2px, -3px)' : `rotate(${(batPosition.x - 50) * 0.1}deg)`,
                transformOrigin: '60px 92px'
              }}>
                <path d="M38,42 C38,42 60,37 82,42 L78,88 L42,88 Z" fill="#ffffff" stroke="#e2e8f0" strokeWidth="1.5" />
                <path d="M46,39 L74,39 L76,46 L44,46 Z" fill="#0284c7" /> {/* Blue Shoulder Collar strips */}
                
                {/* Back Jersey printing matching real batsman context */}
                <text x="60" y="62" fill="#0369a1" fontSize="9" fontWeight="900" textAnchor="middle" fontFamily="sans-serif" letterSpacing="1">
                  VJAGDEEP
                </text>
                <text x="60" y="80" fill="#0284c7" fontSize="15" fontWeight="900" textAnchor="middle" fontFamily="monospace">
                  10
                </text>

                {/* Head, Blue Helmets with steel faceguard visor overlay */}
                <g style={{ transform: 'translate(0, -6px)' }}>
                  <circle cx="60" cy="20" r="10.5" fill="#075985" stroke="#0284c7" strokeWidth="1.5" />
                  <path d="M51,13 Q60,9 69,13" stroke="#00f2ff" strokeWidth="2.5" fill="none" /> {/* Cyber visor strip */}
                  <path d="M60,20 L71,23 L67,30 L58,26 Z" fill="none" stroke="#94a3b8" strokeWidth="1.5" />
                  <line x1="64" y1="21" x2="63" y2="28" stroke="#94a3b8" strokeWidth="1" />
                  <line x1="67" y1="22" x2="65" y2="29" stroke="#94a3b8" strokeWidth="1" />
                </g>

                {/* Professional Left Shoulder / Upper arm segment */}
                <line 
                  x1="38" y1="48" 
                  x2={swingState === 'SWINGING' ? "22" : "34"} 
                  y2={swingState === 'SWINGING' ? "18" : "70"} 
                  stroke="#ffffff" 
                  strokeWidth="5.5" 
                  strokeLinecap="round" 
                />
                {/* Teal Leather Protection Glove */}
                <circle 
                  cx={swingState === 'SWINGING' ? "22" : "34"} 
                  cy={swingState === 'SWINGING' ? "18" : "70"} 
                  r="4" 
                  fill="#00f2ff" 
                  stroke="#0369a1" 
                  strokeWidth="1.2" 
                />

                {/* Professional Right Upper arm segment */}
                <line 
                  x1="82" y1="48" 
                  x2={swingState === 'SWINGING' ? "46" : "56"} 
                  y2={swingState === 'SWINGING' ? "12" : "76"} 
                  stroke="#ffffff" 
                  strokeWidth="5.5" 
                  strokeLinecap="round" 
                />
                {/* Teal Glove */}
                <circle 
                  cx={swingState === 'SWINGING' ? "46" : "56"} 
                  cy={swingState === 'SWINGING' ? "12" : "76"} 
                  r="4" 
                  fill="#00f2ff" 
                  stroke="#0369a1" 
                  strokeWidth="1.2" 
                />
              </g>
            </g>
          </svg>
        </div>

        {/* 1st Person INTERACTIVE BAT (Positioned dynamically on cursor X and Y) */}
        <div 
          className="absolute pointer-events-none z-30 transition-all duration-75 ease-out"
          style={{
            left: `${batPosition.x}%`,
            top: `${batPosition.y}%`,
            transform: `translate(-50%, -50%) rotate(${targetAngle}deg)`
          }}
        >
          {/* Bat glowing guidance crosshair when moving */}
          {swingState === 'IDLE' && (
            <div className="absolute top-12 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border border-dashed border-[#00f2ff]/30 flex items-center justify-center animate-spin">
              <div className="w-1.5 h-1.5 bg-[#00f2ff] rounded-full" />
            </div>
          )}

          <motion.div
            style={{ transformOrigin: 'top center' }}
            animate={
              swingState === 'SWINGING' 
                ? { rotate: [-10, -90, 45, -10], scaleY: [1, 0.85, 1.1, 1], y: [0, -20, 10, 0] } 
                : { rotate: 0, scaleY: 1 }
            }
            transition={{ duration: 0.32, ease: "easeOut" }}
            className="w-16 h-48 relative"
          >
            {/* Glowing grip sleeve colored in high-visibility cyan */}
            <div className="w-3.5 h-16 bg-gradient-to-r from-[#00f2ff] to-cyan-500 rounded-md border border-cyan-400/30 absolute top-0 left-1/2 -translate-x-1/2 flex flex-col justify-between shadow-[0_0_12px_rgba(0,242,255,0.5)]">
              <div className="h-1.5 w-full border-b border-black/25" />
              <div className="h-1.5 w-full border-b border-black/25" />
              <div className="h-1.5 w-full border-b border-black/25" />
              <div className="h-1.5 w-full border-b border-black/25" />
              <div className="h-1.5 w-full border-b border-black/25" />
            </div>
            
            {/* Wood Fiber Blade with dynamic light shadow */}
            <div className="w-7 h-32 bg-gradient-to-r from-amber-200 to-amber-100 rounded-b-lg border border-amber-900/30 absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col justify-end p-1 shadow-2xl">
              <span className="text-[6.5px] text-cyan-600 font-extrabold self-center tracking-widest mb-3 rotate-180 select-none">HERO</span>
              <div className="flex justify-between w-full h-1/2 opacity-25">
                <div className="w-[1.2px] bg-amber-900/50 h-full" />
                <div className="w-[1.2px] bg-amber-900/50 h-full" />
                <div className="w-[1.2px] bg-amber-900/50 h-full" />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Dynamic Shot Action overlay banner */}
        <AnimatePresence>
          {lastShot && (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: -36 }}
              exit={{ opacity: 0, y: -56 }}
              className="z-50 text-center pointer-events-none pb-12"
            >
              <div className="inline-flex items-center gap-4 rounded-2xl border border-white/10 bg-neutral-950/85 px-5 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
                <span className={`text-3xl md:text-4xl font-black italic leading-none ${lastShot.runs >= 4 ? 'text-[#00f2ff]' : lastShot.runs > 0 ? 'text-emerald-400' : lastShot.timing.includes('BOWLED') ? 'text-rose-400' : 'text-white/70'}`}>
                  {lastShot.runs === 0 ? '0' : `+${lastShot.runs}`}
                </span>
                <div className="text-left">
                  <p className="text-[9px] font-black uppercase tracking-[0.28em] text-white/35">Shot</p>
                  <p className="text-sm md:text-base font-black uppercase text-white">{lastShot.type}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#00f2ff]">{lastShot.timing} timing</p>
                </div>
              </div>
              <div className="hidden">
                {lastShot.runs === 6 && (
                  <span className="text-fuchsia-400 uppercase tracking-tight">MASSIVE SIX!</span>
                )}
                {lastShot.runs === 4 && (
                  <span className="text-cyan-400 uppercase tracking-tight">CRACKING FOUR!</span>
                )}
                {lastShot.runs > 0 && lastShot.runs < 4 && (
                  <span className="text-emerald-400 uppercase tracking-tight">{lastShot.runs} RUNS!</span>
                )}
                {lastShot.runs === 0 && lastShot.timing.includes('BOWLED') && (
                  <span className="text-rose-500 uppercase tracking-wider">CLEAN BOWLED!</span>
                )}
                {lastShot.runs === 0 && !lastShot.timing.includes('BOWLED') && (
                  <span className="text-gray-400 uppercase tracking-widest">DOT BALL!</span>
                )}
              </div>
              
              <div className="hidden">
                <Sparkles size={12} className="text-cyan-400 animate-spin" />
                <span>{lastShot.timing} TIMING</span>
                <span className="text-white/30">•</span>
                <span className="text-cyan-400">{lastShot.type}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute inset-x-0 bottom-4 px-4 z-20 pointer-events-none">
        <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-neutral-950/80 backdrop-blur-md shadow-[0_16px_40px_rgba(0,0,0,0.45)] p-3 md:p-4">
          <div className="grid grid-cols-[5.5rem_1fr] md:grid-cols-[6rem_1fr_13rem] gap-3 md:gap-4 items-center">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1] opacity-80" />
              <canvas ref={hiddenCanvasRef} className="hidden" width={32} height={24} />
              <div className="absolute inset-0 border border-[#00f2ff]/20 rounded-xl" />
              <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5">
                <span className={`h-1.5 w-1.5 rounded-full ${cameraStatus === 'ACTIVE' ? 'bg-emerald-400' : cameraStatus === 'ERROR' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                <span className="text-[6px] font-black uppercase tracking-widest text-white">{cameraStatus}</span>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.28em] text-white/35 italic">Webcam Input</p>
                  <p className={`text-xl md:text-3xl font-black uppercase italic tracking-tight ${motionStatusColor}`}>
                    {motionStatus}
                  </p>
                </div>
                <div className="hidden sm:block text-right">
                  <p className="text-[8px] font-black uppercase tracking-[0.25em] text-white/35 italic">Delivery</p>
                  <p className="text-sm font-black uppercase text-white">{selectedDelivery}{selectedDelivery === 'SPIN' ? ` / ${spinType}` : ''}</p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className={`h-full ${motionLevel > 28 ? 'bg-emerald-400' : 'bg-[#00f2ff]'}`}
                  animate={{ width: `${Math.min(100, (motionLevel / 60) * 100)}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>

            <div className="col-span-2 md:col-span-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <p className="text-[8px] font-black uppercase tracking-[0.25em] text-white/35 italic">Current Shot</p>
              <p className="truncate text-sm md:text-base font-black uppercase text-white">
                {lastShot?.type || 'Awaiting swing'}
              </p>
              <p className="truncate text-[10px] font-black uppercase tracking-widest text-[#00f2ff]">
                {lastShot?.timing ? `${lastShot.timing} timing` : 'No timing yet'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
