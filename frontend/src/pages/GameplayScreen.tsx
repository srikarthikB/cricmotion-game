import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameStore } from '../stores/useGameStore';
import { Pause, Target, Zap, Activity, Shield, Users, Camera, RefreshCw, Sparkles, Award } from 'lucide-react';

export const GameplayScreen = () => {
  const setState = useGameStore((state) => state.setState);
  const score = useGameStore((state) => state.score);
  const updateScore = useGameStore((state) => state.updateScore);
  const matchConfig = useGameStore((state) => state.matchConfig);
  const backendMatch = useGameStore((state) => state.backendMatch);
  const user = useGameStore((state) => state.user);

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

  // Interactive Bat Coordination (Horizontal following cursor/drag)
  const [batPosition, setBatPosition] = useState({ x: 50, y: 70 }); // percentages
  const [targetAngle, setTargetAngle] = useState(0); // aim angle based on bat offset
  const [showMatchInfoMenu, setShowMatchInfoMenu] = useState(false);

  // Motion analysis states
  const [motionLevel, setMotionLevel] = useState(0);
  const [isMotionEnabled, setIsMotionEnabled] = useState(false); // Default to off so mouse controls work flawlessy out of the box
  const [motionTriggered, setMotionTriggered] = useState(false);
  const [poseCentroid, setPoseCentroid] = useState<{ x: number; y: number } | null>(null);
  const [poseJoints, setPoseJoints] = useState<{ x: number; y: number }[]>([]);

  // Track Mouse / Touch movement on screen to calculate real-time bat tracking position
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!screenContainerRef.current || swingState !== 'IDLE' || isMotionEnabled) return;
    const rect = screenContainerRef.current.getBoundingClientRect();
    
    // Normalized coordinates (0 to 100)
    let relativeX = ((e.clientX - rect.left) / rect.width) * 100;
    let relativeY = ((e.clientY - rect.top) / rect.height) * 100;
    
    // Constraint values to keep the striker at the batting crease zone
    relativeX = Math.max(15, Math.min(85, relativeX));
    relativeY = Math.max(60, Math.min(92, relativeY));
    
    // Dynamically calculate batting angles based on crease positioning
    const centralAngle = (relativeX - 50) * 1.3; // Swing angle range -45deg to 45deg
    
    setBatPosition({ x: relativeX, y: relativeY });
    setTargetAngle(centralAngle);
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
            videoRef.current.play().catch(() => {});
          }
        } catch (err) {
          console.error("Camera access failed entirely:", err);
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

  // Face next ball trigger (Taps the crease)
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

  // Evaluate swing outcome
  const swingBat = () => {
    if (swingState !== 'IDLE') return;
    
    setSwingState('SWINGING');
    playAudioEffect('SWOOSH');

    setTimeout(() => setSwingState('RECOVERING'), 300);
    setTimeout(() => setSwingState('IDLE'), 500);

    if (ballState === 'RELEASED') {
      const timing = ballProgress;
      let shotRuns = 0;
      let shotTiming = 'POOR';
      let shotType = 'DRIVE';

      // Match the horizontal alignment of the bat with the ball (X tracking accuracy)
      const horizontalMatch = Math.abs(batPosition.x - 50) < 18;

      if (!horizontalMatch) {
        // bat missed the ball's corridor
        setLastShot({ runs: 0, timing: 'MISSED LINE', type: 'BEATEN FOR WIDTH' });
        const nextBalls = score.balls + 1;
        updateScore({
          balls: nextBalls,
          overProgress: `${Math.floor(nextBalls / 6)}.${nextBalls % 6}`,
          currentOver: [...score.currentOver, 0]
        });
        setBallState('DOT');
        return;
      }

      if (timing >= 82 && timing <= 91) {
        shotRuns = Math.random() > 0.4 ? 6 : 4;
        shotTiming = 'PERFECT';
        shotType = shotRuns === 6 ? 'PULL SHOT' : 'COVER DRIVE';
        playAudioEffect('HIT');
        playAudioEffect('CROWD_ROAR');
        setBallState('HIT');
      } else if ((timing >= 74 && timing < 82) || (timing > 91 && timing <= 96)) {
        shotRuns = Math.random() > 0.5 ? 4 : Math.random() > 0.3 ? 2 : 1;
        shotTiming = 'GOOD';
        shotType = 'SQUARE CUT';
        playAudioEffect('HIT');
        if (shotRuns === 4) playAudioEffect('CROWD_ROAR');
        setBallState('HIT');
      } else if (timing >= 64 && timing < 74) {
        shotRuns = Math.random() > 0.6 ? 1 : 0;
        shotTiming = 'TOO EARLY';
        shotType = 'DEFENSIVE POKE';
        if (shotRuns > 0) playAudioEffect('HIT');
        setBallState('HIT');
      } else if (timing > 96 && timing <= 101) {
        shotRuns = Math.random() > 0.7 ? 1 : 0;
        shotTiming = 'TOO LATE';
        shotType = 'THICK-EDGE SLICE';
        if (shotRuns > 0) playAudioEffect('HIT');
        setBallState('HIT');
      } else {
        return;
      }

      setLastShot({ runs: shotRuns, timing: shotTiming, type: shotType });
      const nextBalls = score.balls + 1;
      updateScore({
        runs: score.runs + shotRuns,
        balls: nextBalls,
        overProgress: `${Math.floor(nextBalls / 6)}.${nextBalls % 6}`,
        currentOver: [...score.currentOver, shotRuns]
      });

      if (!backendMatch) return;

      const maxBalls = backendMatch.overs * 6;
      if (nextBalls >= maxBalls) {
        setTimeout(() => setState('SUMMARY'), 2500);
      }
    }
  };

  // Handle dot or bowled if ball goes untouched
  const handleDotOrWicket = () => {
    if (!backendMatch) return;

    const bowlChance = selectedDelivery === 'FAST' ? 0.6 : selectedDelivery === 'MEDIUM' ? 0.45 : 0.3;
    const isBowled = Math.random() < bowlChance;

    const nextBalls = score.balls + 1;
    
    if (isBowled) {
      playAudioEffect('WICKET');
      setBallState('BOWLED');
      setLastShot({ runs: 0, timing: 'BOWLED STUMPS CHATTER', type: 'CLEAN BOWLED' });
      
      updateScore({
        wickets: score.wickets + 1,
        balls: nextBalls,
        overProgress: `${Math.floor(nextBalls / 6)}.${nextBalls % 6}`,
        currentOver: [...score.currentOver, -1]
      });
    } else {
      setBallState('DOT');
      setLastShot({ runs: 0, timing: 'DOT BALL', type: 'DEFENDED / BEATEN' });
      
      updateScore({
        balls: nextBalls,
        overProgress: `${Math.floor(nextBalls / 6)}.${nextBalls % 6}`,
        currentOver: [...score.currentOver, 0]
      });
    }

    const maxBalls = backendMatch.overs * 6;
    const isWicketLimit = score.wickets + (isBowled ? 1 : 0) >= (matchConfig?.wickets || 10);
    
    if (nextBalls >= maxBalls || isWicketLimit) {
      setTimeout(() => setState('SUMMARY'), 2500);
    }
  };

  // Keyboard Spacebar integration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        swingBat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [swingState, ballState, ballProgress, batPosition]);

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
  
  const strikeRate = score.balls > 0 
    ? ((score.runs / score.balls) * 100).toFixed(1) 
    : '0.0';

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
      onPointerMove={handlePointerMove}
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

        {/* Floating atmospheric elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[35%] left-[25%] w-1.5 h-1.5 bg-yellow-400/20 rounded-full blur-[1px] animate-pulse" />
          <div className="absolute top-[50%] left-[75%] w-2 h-2 bg-yellow-400/15 rounded-full blur-[2px] animate-bounce" style={{ animationDuration: '6s' }} />
          <div className="absolute top-[28%] left-[60%] w-1.5 h-1.5 bg-cyan-400/20 rounded-full blur-[1px]" />
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/35" />
      </div>

      {/* 2. CLONED HIGH-FIDELITY SMARTPHONE HUD HEADER CONTAINER
          Perfect matches layout from the supplied screenshot */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[94%] max-w-lg bg-neutral-950/90 backdrop-blur-md rounded-2xl p-3 border border-neutral-800 shadow-[0_12px_24px_rgba(0,0,0,0.85)] z-40 flex items-center justify-between">
        
        {/* A. LEFT COLUMN: HAMBURGER, SCORE AND OVER GAUGE */}
        <div id="hud_left_col" className="flex flex-col flex-1 pr-3">
          <div className="flex items-center space-x-2">
            {/* Hamburger list layout icon in Cyan color */}
            <button 
              onClick={() => setShowMatchInfoMenu(!showMatchInfoMenu)}
              className="p-1 hover:bg-white/5 rounded-md transition-colors pointer-events-auto"
            >
              <svg className="w-5 h-5 text-[#00f2ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            </button>

            {/* Huge bold score digits: "Runs-Wickets" in condensed heavy weight */}
            <span className="text-3xl md:text-4xl font-extrabold text-white tracking-widest font-mono drop-shadow-[0_2px_4px_black]">
              {score.runs}-{score.wickets}
            </span>
          </div>

          <div className="flex items-baseline space-x-1.5 mt-0.5 ml-1">
            {/* Current Over inside parentheses e.g. (0.0) */}
            <span className="text-xs font-black text-neutral-400 font-mono tracking-wider">
              ({score.overProgress})
            </span>
          </div>

          {/* Indigo/Violet battery progress bar with a helmet icon */}
          <div className="flex items-center space-x-2 mt-2 w-full">
            <div className="text-neutral-400">
              {/* Helmet icon/avatar representation */}
              <svg className="w-4 h-4 text-purple-400 fill-purple-400/20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.95.56 3.77 1.53 5.31L2.5 22l4.69-1.03C8.73 21.44 10.3 21.75 12 21.75c5.52 0 10-4.43 10-9.75S17.52 2 12 2zm1 14.5h-2v-2h2v2zm0-4h-2v-4h2v4z" />
              </svg>
            </div>
            {/* The actual progress bar */}
            <div className="flex-1 h-3 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
              <motion.div 
                className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 shadow-[0_0_8px_#c084fc]"
                animate={{ width: `${Math.min(100, (score.balls / totalBalls) * 100)}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        </div>

        {/* B. CENTER COLUMN: BOWLER SPEED TEXT LABEL & RED BALL ICON OVERLAY + HUGE CYAN CYBER COUNTER */}
        <div id="hud_center_col" className="flex flex-col items-center justify-center border-x border-neutral-800/80 px-4 text-center min-w-[120px]">
          <div className="flex items-center space-x-1 justify-center">
            {/* flying mini cricket ball with motion streaks layout */}
            <svg className="w-4 h-4 text-red-500 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
              <path d="m21.9 11.23-1.88-.38c.07-.41.07-.82.02-1.23l1.83-.55c.29-.09.43-.39.34-.67L20.89 4.3c-.09-.28-.39-.43-.67-.34l-1.83.55c-.29-.29-.62-.53-.98-.73l.63-1.81c.1-.28-.05-.59-.34-.68l-4.1-.73c-.28-.05-.59.1-.68.34l-.63 1.8c-.41-.05-.83-.04-1.24.03l-.42-1.87c-.06-.29-.35-.47-.64-.4l-4.1.91c-.29.07-.47.35-.4.64l.42 1.88c-.37.19-.7.43-.99.71L3.92 3.65c-.2-.2-.53-.2-.73 0L.3 6.54c-.2.2-.2.53 0 .73l1.31 1.31c-.24.33-.43.71-.56 1.11L.3 10.37c-.22.2-.26.54-.08.79l2.4 3.39c.18.25.53.31.79.13l.75-.54c.2.35.45.67.74.94l-1.07 1.57c-.16.24-.09.57.15.73l3.39 2.22c.24.16.57.09.73-.15l1.07-1.57c.37.16.76.27 1.17.33l-.22 1.91c-.03.29.17.55.46.59l4.1.45c.29.03.55-.17.59-.46l.22-1.92c.41.01.82-.04 1.22-.15l.59 1.83c.09.28.39.43.68.34l4.1-1.32c.28-.09.43-.39.34-.68l-.59-1.82c.31-.22.59-.49.83-.79l1.63 1.01c.25.15.58.07.74-.18l2.25-3.56c.16-.25.08-.58-.17-.74l-1.64-1zM11.6 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
            </svg>
            <span className="text-sm font-black tracking-widest text-white uppercase italic">
              {selectedDelivery}
            </span>
          </div>

          <span className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase mt-1">
            BALLS LEFT
          </span>
          {/* Huge neon cyan characters matched exactly */}
          <span className="text-4xl md:text-5xl font-black text-[#00f2ff] tracking-tight font-sans mt-0.5 leading-none">
            {ballsLeft}
          </span>
        </div>

        {/* C. RIGHT COLUMN: BEAUTIFUL CIRCULAR RADAR FIELD MAP WIDGET
            Dynamic view of fielders vector circles from above */}
        <div id="hud_right_col" className="flex items-center justify-end flex-1 pl-3 pointer-events-auto">
          <div className="relative w-16 h-16 rounded-full border border-neutral-700 bg-neutral-900 shadow-inner flex items-center justify-center">
            
            {/* Center Turf Pitch Line overlay */}
            <div className="absolute w-[2.5px] h-6 bg-amber-700/60 rounded-sm transform rotate-12" />

            {/* Dynamic Highlight direction slice based on slider/bat placement */}
            <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none" viewBox="0 0 100 100">
              {/* Sector slice highlight covering the wedge area */}
              <path 
                d="M50,50 L85,30 A40,40 0 0,1 85,70 Z" 
                fill="#14b8a6" 
                fillOpacity="0.25"
                stroke="#14b8a6"
                strokeWidth="0.8"
                className="transition-all duration-300"
                style={{ 
                  transformOrigin: '50px 50px',
                  transform: `rotate(${targetAngle}deg)`
                }}
              />
              
              {/* 11 circular fielder position coordinates */}
              <circle cx="20" cy="50" r="2.5" fill="white" />
              <circle cx="32" cy="25" r="2.5" fill="white" />
              <circle cx="45" cy="15" r="2.5" fill="white" />
              <circle cx="68" cy="22" r="2.5" fill="white" />
              <circle cx="80" cy="42" r="2.5" fill="white" />
              <circle cx="78" cy="65" r="2.5" fill="white" />
              <circle cx="58" cy="85" r="2.5" fill="white" />
              <circle cx="35" cy="82" r="2.5" fill="white" />
              <circle cx="24" cy="68" r="2.5" fill="white" />
              <circle cx="50" cy="40" r="3" fill="cyan" className="animate-pulse" /> {/* Ball/bowler spot */}
              <circle cx="50" cy="65" r="3" fill="#f43f5e" /> {/* Striker spot */}
            </svg>
          </div>
        </div>
      </div>

      {/* Hamburger Menu Overlay Dropdown */}
      <AnimatePresence>
        {showMatchInfoMenu && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-24 left-[3%] w-[94%] max-w-sm bg-neutral-950/95 backdrop-blur-2xl border border-neutral-800 rounded-2xl p-4 shadow-2xl z-50 flex flex-col space-y-3"
          >
            <div className="flex justify-between items-center border-b border-neutral-800 pb-2">
              <span className="text-xs font-black text-[#00f2ff] tracking-widest uppercase italic">MATCH OVERVIEW</span>
              <button onClick={() => setShowMatchInfoMenu(false)} className="text-white/40 hover:text-white text-xs">Close</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-neutral-900/60 p-2 rounded-lg border border-neutral-800">
                <span className="text-neutral-500 block">Striker</span>
                <span className="text-white uppercase font-black font-mono">{user?.name ? user.name.split('@')[0] : 'VJAGDEEPSAI'}</span>
              </div>
              <div className="bg-neutral-900/60 p-2 rounded-lg border border-neutral-800">
                <span className="text-neutral-500 block">Strike Rate</span>
                <span className="text-[#00f2ff] font-mono font-bold">{strikeRate}</span>
              </div>
              <div className="bg-neutral-900/60 p-2 rounded-lg border border-neutral-800">
                <span className="text-neutral-500 block">Balls Played</span>
                <span className="text-white font-mono font-bold">{score.balls}</span>
              </div>
              <div className="bg-neutral-900/60 p-2 rounded-lg border border-neutral-800">
                <span className="text-neutral-500 block">Match Overs</span>
                <span className="text-white font-mono font-bold">{totalOvers} Overs</span>
              </div>
              <div className="bg-neutral-900/60 p-2 rounded-lg border border-neutral-800">
                <span className="text-neutral-500 block">Target</span>
                <span className="text-white font-mono font-bold">{target}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              initial={{ scale: 0.6, opacity: 0, y: 10 }}
              animate={{ scale: 1.15, opacity: 1, y: -45 }}
              exit={{ scale: 1.3, opacity: 0 }}
              className="z-50 text-center pointer-events-none pb-12"
            >
              <h1 className="text-5xl md:text-6xl font-black italic tracking-tighter drop-shadow-[0_4px_16px_rgba(0,242,255,0.4)] text-white">
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
              </h1>
              
              <div className="inline-flex mt-4 px-6 py-2 bg-slate-950/90 border border-neutral-800 text-white font-black italic tracking-widest uppercase items-center space-x-2 text-xs rounded-xl">
                <Sparkles size={12} className="text-cyan-400 animate-spin" />
                <span>{lastShot.timing} TIMING</span>
                <span className="text-white/30">•</span>
                <span className="text-cyan-400">{lastShot.type}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. DUAL MODE INPUTS BAR (Bottom left gesture webcam module and bottom-right click interaction) */}
      <div className="absolute inset-x-0 bottom-6 px-6 flex justify-between items-end z-20 pointer-events-none">
        
        {/* A. OPTIONAL GESTURE SENSORS BOX */}
        <div className="w-52 bg-slate-950/95 backdrop-blur-md rounded-2xl p-2.5 border border-neutral-800 shadow-[0_12px_24px_rgba(0,0,0,0.8)] flex flex-col space-y-2 pointer-events-auto">
          {isMotionEnabled ? (
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-900 border border-neutral-800">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1] opacity-75" />
              <canvas ref={hiddenCanvasRef} className="hidden" width={32} height={24} />
              
              {/* Dynamic Live Pose estimation cyber skeleton overlay */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 32 24">
                {poseJoints.length > 0 && (
                  <g stroke="#00f2ff" strokeWidth="0.5" opacity="0.85">
                    {/* Draw spine bone */}
                    <line x1={poseJoints[0].x} y1={poseJoints[0].y} x2={poseJoints[1].x} y2={poseJoints[1].y} />
                    {/* Draw arms bones */}
                    <line x1={poseJoints[0].x} y1={poseJoints[0].y} x2={poseJoints[2].x} y2={poseJoints[2].y} />
                    <line x1={poseJoints[0].x} y1={poseJoints[0].y} x2={poseJoints[3].x} y2={poseJoints[3].y} />
                    {/* Draw legs bones */}
                    <line x1={poseJoints[0].x} y1={poseJoints[0].y} x2={poseJoints[4].x} y2={poseJoints[4].y} />
                    <line x1={poseJoints[0].x} y1={poseJoints[0].y} x2={poseJoints[5].x} y2={poseJoints[5].y} />
                    
                    {/* Joint Indicator Dots */}
                    {poseJoints.map((joint, index) => (
                      <circle 
                        key={index} 
                        cx={joint.x} 
                        cy={joint.y} 
                        r={index === 1 ? 0.9 : 0.6} 
                        fill={index === 1 ? "#ef4444" : "#00f2ff"} 
                        stroke="#09333f" 
                        strokeWidth="0.15" 
                      />
                    ))}
                  </g>
                )}
              </svg>

              <div className="absolute inset-2 border border-[#00f2ff]/20 rounded-lg pointer-events-none" />
              <div className="absolute top-1.5 left-1.5 flex items-center space-x-1 bg-black/75 px-2 py-0.5 rounded-full">
                <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[6px] font-black text-white tracking-widest uppercase">REAL POSING</span>
              </div>
              
              <div className="absolute bottom-1.5 inset-x-1.5 bg-neutral-950/90 px-1.5 py-0.5 border border-[#00f2ff]/20 rounded text-center">
                <span className="text-[6.5px] font-black text-[#00f2ff] uppercase tracking-widest animate-pulse block">
                  {motionLevel > 18 ? "⚡ SWING DETECTED" : "WAVE HANDS TO HIT"}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-2 text-center">
              <p className="text-[9px] text-neutral-400 font-medium">Use mouse movement or touch drag to move the cricket bat naturally.</p>
            </div>
          )}

          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setIsMotionEnabled(!isMotionEnabled)}
                className={`text-[8.5px] font-black uppercase tracking-wider px-2 py-1 rounded-lg transition-all border ${isMotionEnabled ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' : 'bg-neutral-900 text-neutral-500 border-neutral-800'}`}
              >
                {isMotionEnabled ? 'Webcam ON' : 'Webcam OFF'}
              </button>
              {isMotionEnabled && <div className="text-[7.5px] font-mono text-neutral-500">LEVEL: {motionLevel.toFixed(0)}</div>}
            </div>

            {isMotionEnabled && (
              <div className="h-1 bg-neutral-900 rounded-full overflow-hidden flex items-center">
                <motion.div 
                  className={`h-full ${motionLevel > 28 ? 'bg-emerald-400' : 'bg-cyan-400'}`}
                  animate={{ width: `${Math.min(100, (motionLevel / 60) * 100)}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            )}
          </div>
        </div>

        {/* B. BATTING TRIGGER ACTIONS & CREASE TAPPING PANEL */}
        <div className="flex flex-col space-y-3.5 items-end pointer-events-auto">
          <div className="bg-neutral-950/95 backdrop-blur-md border border-neutral-800 p-2.5 rounded-2xl flex space-x-3.5 items-center">
            <div className="flex flex-col">
              <span className="text-[7.5px] font-bold text-neutral-500 uppercase tracking-widest italic">DELIVERY TYPE</span>
              <span className="text-xs font-black text-[#00f2ff] tracking-wide uppercase">
                {selectedDelivery} {selectedDelivery === 'SPIN' ? `(${spinType})` : ''}
              </span>
            </div>
            
            <button 
              onClick={faceNextBall}
              disabled={bowlerState === 'RUNNING' || bowlerState === 'DELIVERING' || ballState === 'RELEASED'}
              className="py-1.5 px-3 bg-[#00f2ff]/10 border border-[#00f2ff]/30 text-[#00f2ff] hover:bg-[#00f2ff] hover:text-black rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all flex items-center space-x-1.5 disabled:opacity-40"
            >
              <RefreshCw size={10} />
              <span>NEXT ENCOUNTER</span>
            </button>
          </div>

          <motion.button 
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={swingBat}
            className="px-8 py-4.5 rounded-3xl bg-gradient-to-r from-cyan-400 to-[#14b8a6] text-black font-black italic tracking-[0.2em] text-sm hover:from-cyan-300 hover:to-teal-400 shadow-[0_0_30px_rgba(0,242,255,0.4)] uppercase border border-cyan-300 flex items-center space-x-2"
          >
            <Zap size={16} className="fill-black" />
            <span>PLAY SHOT</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
};
