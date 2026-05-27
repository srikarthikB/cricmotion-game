import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '../stores/useGameStore';
import { apiService } from '../services/apiService';
import { getVenueById } from '../constants';
import { BallResultResponse, PredictShotResponse } from '../types';
import { Pause, Target, Zap, Activity, Shield, Users, Camera, RefreshCw, Sparkles, Award, Home } from 'lucide-react';

export const GameplayScreen = () => {
  const setState = useGameStore((state) => state.setState);
  const score = useGameStore((state) => state.score);
  const updateScore = useGameStore((state) => state.updateScore);
  const backendMatch = useGameStore((state) => state.backendMatch);
  const selectedVenueId = useGameStore((state) => state.matchConfig.venue);
  const setBackendMatch = useGameStore((state) => state.setBackendMatch);
  const resetScore = useGameStore((state) => state.resetScore);

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

  const selectedVenue = getVenueById(selectedVenueId);
  const cricketBg = selectedVenue.gameplayBg;

  // References
  const videoRef = useRef<HTMLVideoElement>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const screenContainerRef = useRef<HTMLDivElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

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

  const stopCameraStream = useCallback(() => {
    const activeStream = mediaStreamRef.current;

    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStreamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    prevFrameDataRef.current = null;
    setCameraStatus(isMotionEnabled ? 'BOOTING' : 'ERROR');
    setMotionLevel(0);
    setMotionTriggered(false);
    setPoseCentroid(null);
    setPoseJoints([]);
  }, [isMotionEnabled]);

  const exitToDashboard = () => {
    stopCameraStream();
    setBackendMatch(null);
    resetScore();
    setState('DASHBOARD');
  };

  // Setup Web Camera
  useEffect(() => {
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
        stopCameraStream();
        mediaStreamRef.current = stream;
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
          stopCameraStream();
          mediaStreamRef.current = fallbackStream;
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
        stopCameraStream();
      };
    } else {
      stopCameraStream();
    }
  }, [isMotionEnabled, stopCameraStream]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, [stopCameraStream]);

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

  const cvSignalItems = [
    {
      label: 'Camera',
      value: cameraStatus === 'ACTIVE' ? 'Connected' : cameraStatus === 'ERROR' ? 'Unavailable' : 'Connecting',
      icon: Camera,
      active: cameraStatus === 'ACTIVE',
      warning: cameraStatus === 'ERROR',
    },
    {
      label: 'Motion',
      value: isMotionEnabled && cameraStatus === 'ACTIVE' ? 'Detection Active' : 'Standby',
      icon: Activity,
      active: isMotionEnabled && cameraStatus === 'ACTIVE',
      warning: cameraStatus === 'ERROR',
    },
    {
      label: 'Player',
      value: poseCentroid ? 'Tracking Player' : cameraStatus === 'ACTIVE' ? 'Finding Stance' : 'No Signal',
      icon: Target,
      active: Boolean(poseCentroid),
      warning: cameraStatus === 'ERROR',
    },
    {
      label: 'Swing',
      value: ballState === 'RELEASED' ? 'Waiting For Swing' : swingState === 'SWINGING' ? 'Swing Captured' : 'Queued',
      icon: Zap,
      active: ballState === 'RELEASED' || swingState === 'SWINGING',
      warning: false,
    },
  ];

  const cvFeedbackState = cameraStatus === 'ERROR'
    ? 'Camera permission needed'
    : swingState === 'SWINGING'
      ? 'Swing gesture captured'
      : ballState === 'RELEASED'
        ? 'Waiting for swing'
        : poseCentroid
          ? 'Player tracking stable'
          : cameraStatus === 'ACTIVE'
            ? 'Tracking player stance'
            : 'Preparing camera';

  const cvReadiness = cameraStatus === 'ACTIVE'
    ? Math.min(100, 45 + (poseCentroid ? 30 : 0) + Math.min(25, motionLevel))
    : cameraStatus === 'ERROR'
      ? 8
      : 22;

  const swingWindowActive = ballState === 'RELEASED' && ballProgress > 68;
  const stanceConfidence = cameraStatus === 'ACTIVE'
    ? Math.min(99, Math.round(52 + (poseCentroid ? 28 : 0) + Math.min(19, motionLevel / 2)))
    : 0;
  const battingCue = cameraStatus === 'ERROR'
    ? 'Camera needed'
    : swingState === 'SWINGING'
      ? 'Swing detected'
      : swingWindowActive
        ? 'Swing now'
        : poseCentroid
          ? 'Stance detected'
          : 'Step into frame';
  const shotFeedbackTone = lastShot
    ? lastShot.runs >= 4
      ? 'Power shot'
      : lastShot.runs > 0
        ? 'Good contact'
        : lastShot.timing.includes('MISS')
          ? 'Missed timing'
          : 'Dot ball'
    : swingWindowActive
      ? 'Track the ball'
      : 'Ready stance';

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
          alt={`${selectedVenue.name} batting view`}
          fetchPriority="high"
          className="w-full h-full object-cover object-center scale-[1.03] filter brightness-95"
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

      <motion.button
        whileHover={{ scale: 1.03, x: -2 }}
        whileTap={{ scale: 0.96 }}
        onClick={exitToDashboard}
        className="pointer-events-auto absolute left-3 top-3 z-50 inline-flex items-center gap-2 rounded-2xl border border-cyan-200/15 bg-neutral-950/48 px-3 py-2 text-[10px] font-black uppercase italic tracking-[0.2em] text-cyan-100/80 shadow-[0_10px_28px_rgba(0,0,0,0.28)] backdrop-blur-md transition-colors hover:border-cyan-200/35 hover:bg-cyan-300/10 hover:text-cyan-50 sm:left-4 sm:top-4"
        aria-label="Exit match and return to dashboard"
      >
        <Home size={15} />
        <span className="hidden sm:inline">Exit</span>
      </motion.button>

      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[calc(100%-1rem)] max-w-5xl z-40 pointer-events-none px-2">
        <div className="mx-auto flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-950/45 px-3 py-2 shadow-[0_10px_32px_rgba(0,0,0,0.28)] backdrop-blur-md md:px-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[9px] font-black uppercase italic tracking-[0.24em] text-cyan-100/50">Score</span>
            <span className="text-3xl font-black leading-none tracking-tight text-white md:text-4xl">{score.runs}</span>
            <span className="text-lg font-black leading-none text-white/45">/ {score.wickets}</span>
          </div>

          <div className="hidden h-8 w-px bg-white/10 sm:block" />

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-right sm:justify-between">
            <div className="hidden sm:block">
              <p className="text-[8px] font-black uppercase tracking-[0.22em] text-white/35">Overs</p>
              <p className="text-sm font-black uppercase text-white/80">{score.overProgress}</p>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.22em] text-white/35">Target</p>
              <p className="text-sm font-black uppercase text-white/85">{target}</p>
            </div>
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.22em] text-white/35">Balls Left</p>
              <p className="text-sm font-black uppercase text-cyan-100">{ballsLeft}</p>
            </div>
            <div className="hidden md:block">
              <p className="text-[8px] font-black uppercase tracking-[0.22em] text-white/35">Delivery</p>
              <p className="text-sm font-black uppercase text-white/85">{selectedDelivery}</p>
            </div>
          </div>

          <div className="absolute inset-x-3 -bottom-1 h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-300 to-emerald-400"
              animate={{ width: `${Math.min(100, (score.balls / totalBalls) * 100)}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>

      {/* 3. SIMULATION VIEWPORT & ANIMATED ENTITIES */}
      <div className="relative flex-1 flex flex-col items-center justify-center z-10 pointer-events-none mt-12">
        
        {/* Pitch lanes guidance boundaries */}
        <div className="absolute inset-x-0 bottom-[22%] h-28 bg-emerald-400/[0.015] transform -skew-x-12 border-y border-emerald-400/5 z-0" />

        <div className="absolute inset-x-0 bottom-[17%] z-20 flex justify-center px-6">
          <motion.div
            animate={{
              opacity: swingWindowActive ? [0.72, 1, 0.72] : 0.72,
              scale: swingWindowActive ? [1, 1.025, 1] : 1,
            }}
            transition={{ duration: 0.9, repeat: swingWindowActive ? Infinity : 0 }}
            className={`relative h-24 w-full max-w-xl rounded-[50%] border transition-colors ${
              swingWindowActive
                ? 'border-emerald-300/45 bg-emerald-400/[0.035] shadow-[0_0_38px_rgba(94,224,160,0.16)]'
                : poseCentroid
                  ? 'border-cyan-200/32 bg-cyan-300/[0.025]'
                  : 'border-white/14 bg-white/[0.015]'
            }`}
          >
            <div className="absolute left-1/2 top-1/2 h-px w-[76%] -translate-x-1/2 bg-gradient-to-r from-transparent via-cyan-100/45 to-transparent" />
            <div className="absolute left-1/2 top-1/2 h-[72%] w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-cyan-100/30 to-transparent" />
            <div
              className="absolute top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-100/50 bg-cyan-300/15 shadow-[0_0_20px_rgba(103,232,249,0.28)] transition-all duration-75"
              style={{ left: `${batPosition.x}%` }}
            />
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-cyan-100/15 bg-black/45 px-3 py-1 text-[9px] font-black uppercase italic tracking-[0.24em] text-cyan-100/80 backdrop-blur-md">
              You are batting / webcam drives the swing
            </div>
          </motion.div>
        </div>

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

        {/* First-person motion swing guide: the player is the batsman. */}
        <div 
          className="absolute pointer-events-none z-30 transition-all duration-75 ease-out"
          style={{
            left: `${batPosition.x}%`,
            top: `${batPosition.y + 2}%`,
            transform: `translate(-50%, -50%) rotate(${targetAngle * 0.35}deg)`
          }}
        >
          <motion.div
            style={{ transformOrigin: 'center bottom' }}
            animate={
              swingState === 'SWINGING' 
                ? { rotate: [-16, -34, 24, 0], scale: [1, 1.18, 1.06, 1], opacity: [0.8, 1, 0.92, 0.8] } 
                : { rotate: 0, scale: swingWindowActive ? [1, 1.06, 1] : 1, opacity: swingWindowActive ? [0.58, 0.9, 0.58] : 0.62 }
            }
            transition={{ duration: swingState === 'SWINGING' ? 0.34 : 1, repeat: swingWindowActive && swingState !== 'SWINGING' ? Infinity : 0, ease: "easeOut" }}
            className="relative h-28 w-48"
          >
            <div className="absolute left-1/2 top-1/2 h-20 w-40 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-cyan-100/30 border-t-transparent shadow-[0_0_30px_rgba(103,232,249,0.12)]" />
            <div className="absolute left-1/2 top-1/2 h-3 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-r from-transparent via-cyan-200/40 to-transparent blur-sm" />
            <div className={`absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border ${swingWindowActive ? 'border-emerald-300 bg-emerald-400/20 shadow-[0_0_24px_rgba(94,224,160,0.34)]' : 'border-cyan-200/55 bg-cyan-300/15'}`} />
          </motion.div>

          <div className="absolute left-1/2 top-24 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[9px] font-black uppercase italic tracking-[0.22em] text-white/72 backdrop-blur-md">
            {battingCue}
          </div>
        </div>

        {/* Dynamic Shot Action overlay banner */}
        <AnimatePresence>
          {lastShot && (
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.94 }}
              animate={{ opacity: 1, y: -30, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.96 }}
              className="z-50 text-center pointer-events-none pb-10"
            >
              <div className={`inline-flex items-center gap-4 rounded-2xl border px-5 py-3 shadow-[0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur-md ${
                lastShot.runs >= 4
                  ? 'border-cyan-200/35 bg-cyan-300/12'
                  : lastShot.runs > 0
                    ? 'border-emerald-300/30 bg-emerald-400/12'
                    : 'border-white/10 bg-neutral-950/70'
              }`}>
                <span className={`text-3xl md:text-4xl font-black italic leading-none ${lastShot.runs >= 4 ? 'text-[#00f2ff]' : lastShot.runs > 0 ? 'text-emerald-400' : lastShot.timing.includes('BOWLED') ? 'text-rose-400' : 'text-white/70'}`}>
                  {lastShot.runs === 0 ? '0' : `+${lastShot.runs}`}
                </span>
                <div className="text-left">
                  <p className="text-[9px] font-black uppercase tracking-[0.28em] text-white/45">{shotFeedbackTone}</p>
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

      <div className="absolute inset-x-3 bottom-3 z-20 pointer-events-none lg:inset-x-auto lg:right-4 lg:top-20 lg:bottom-auto lg:w-72">
        <div className="rounded-2xl border border-cyan-200/15 bg-neutral-950/72 p-3 shadow-[0_16px_42px_rgba(0,0,0,0.38)] backdrop-blur-md md:p-4 lg:bg-neutral-950/62">
          <div className="grid grid-cols-[5.25rem_1fr] gap-3 lg:flex lg:flex-col lg:gap-3">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-cyan-200/15 bg-black lg:aspect-video">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1] opacity-80" />
              <canvas ref={hiddenCanvasRef} className="hidden" width={32} height={24} />
              <div className="absolute inset-0 rounded-xl border border-cyan-200/20 shadow-[inset_0_0_22px_rgba(103,232,249,0.08)]" />
              <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-200/15" />
              <div className="absolute inset-y-0 left-1/2 w-px bg-cyan-200/15" />
              <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5">
                <span className={`h-1.5 w-1.5 rounded-full ${cameraStatus === 'ACTIVE' ? 'bg-emerald-400' : cameraStatus === 'ERROR' ? 'bg-rose-500' : 'bg-amber-400'}`} />
                <span className="text-[6px] font-black uppercase tracking-widest text-white">{cameraStatus}</span>
              </div>
              <div className="absolute inset-x-1.5 bottom-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-center text-[6px] font-black uppercase tracking-widest text-cyan-100/75">
                You
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.28em] text-cyan-100/45 italic">Motion Control</p>
                  <p className={`text-lg font-black uppercase italic tracking-tight md:text-xl ${motionStatusColor}`}>
                    {motionStatus}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/45">
                    CV bridge: {cvFeedbackState}
                  </p>
                </div>
                <div className="hidden text-right lg:block">
                  <p className="text-[8px] font-black uppercase tracking-[0.25em] text-white/35 italic">Delivery</p>
                  <p className="text-sm font-black uppercase text-white">{selectedDelivery}{selectedDelivery === 'SPIN' ? ` / ${spinType}` : ''}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className={`h-full ${motionLevel > 28 ? 'bg-emerald-400' : 'bg-[#00f2ff]'}`}
                    animate={{ width: `${Math.min(100, (motionLevel / 60) * 100)}%` }}
                    transition={{ duration: 0.1 }}
                  />
                </div>
                <span className="text-[8px] font-black uppercase tracking-widest text-white/45">
                  Stance {stanceConfidence}%
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {cvSignalItems.map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-xl border px-2.5 py-2 transition-colors ${
                      item.warning
                        ? 'border-rose-400/25 bg-rose-500/10 text-rose-200'
                        : item.active
                          ? 'border-cyan-200/25 bg-cyan-300/10 text-cyan-100'
                          : 'border-white/10 bg-white/[0.035] text-white/50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <item.icon size={12} />
                      <span className="text-[7px] font-black uppercase tracking-[0.2em]">{item.label}</span>
                    </div>
                    <p className="mt-1 truncate text-[9px] font-black uppercase tracking-wide">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 lg:col-span-1">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[8px] font-black uppercase tracking-[0.25em] text-white/35 italic">Shot Feedback</p>
                <span className="rounded-full border border-cyan-200/15 bg-cyan-300/10 px-2 py-0.5 text-[7px] font-black uppercase tracking-widest text-cyan-100/80">
                  Ready {Math.round(cvReadiness)}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-3xl font-black italic leading-none ${lastShot && lastShot.runs > 0 ? 'text-emerald-400' : swingWindowActive ? 'text-cyan-200' : 'text-white/55'}`}>
                  {lastShot ? (lastShot.runs === 0 ? '0' : `+${lastShot.runs}`) : '--'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm md:text-base font-black uppercase text-white">
                    {lastShot?.type || shotFeedbackTone}
                  </p>
                  <p className="truncate text-[10px] font-black uppercase tracking-widest text-[#00f2ff]">
                    {lastShot?.timing ? `${lastShot.timing} timing` : battingCue}
                  </p>
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full bg-gradient-to-r from-cyan-300 to-emerald-400"
                  animate={{ width: `${cvReadiness}%` }}
                  transition={{ duration: 0.25 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
