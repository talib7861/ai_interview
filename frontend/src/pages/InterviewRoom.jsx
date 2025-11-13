// import React, { useEffect, useState, useRef } from "react";
// import { getToken } from "../auth";
// import axios from "axios";

// const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// export default function InterviewRoom({ userId }) {
//     const [ws, setWs] = useState(null);
//     const [logs, setLogs] = useState([]);
//     const [currentQuestion, setCurrentQuestion] = useState(null);
//     const [questions, setQuestions] = useState([]);
//     const [questionIndex, setQuestionIndex] = useState(0);
//     const [interviewId, setInterviewId] = useState(null);
    
//     // Media Access State & Refs
//     const localVideoRef = useRef(null);
//     const localStreamRef = useRef(null);
//     // --- NEW REFS FOR RECORDING ---
//     const mediaRecorderRef = useRef(null); 
//     const audioChunksRef = useRef([]);     
    
//     const [isRecording, setIsRecording] = useState(false); // State indicates if media is active AND recording
    
//     const roomId = `interview-${userId}`;

//     // --- EFFECT: WEBSOCKET CONNECTION (UNCHANGED) ---
//     useEffect(() => {
//         if (!userId) {
//             setLogs(l => [...l, "Error: User ID is missing, cannot connect WS."]);
//             return;
//         }
        
//         const token = getToken();
//         const w = new WebSocket(`ws://localhost:8000/ws/${roomId}?token=${token}`);
        
//         w.onopen = () => setLogs(l => [...l, "WebSocket connected"]);
//         w.onmessage = (ev) => {
//             const data = JSON.parse(ev.data);
//             setLogs(l => [...l, JSON.stringify(data)]);
            
//             // Check for transcription results or evaluation feedback
//             if (data.type === 'evaluation') {
//                 alert(`Feedback received! Score: ${data.evaluation.combined_score}`);
//                 setTimeout(nextQuestion, 1500);
//             } else if (data.type === 'transcript_result') {
//                  setLogs(l => [...l, `Transcript: ${data.text}`]);
//             }
//         };
//         w.onclose = () => setLogs(l => [...l, "WebSocket closed"]);

//         setWs(w);
//         return () => w.close();
//     }, [roomId, userId]);
    
//     // --- FUNCTION: Start Camera, Mic, and Recorder ---
//     const startLocalMedia = async () => {
//         if (isRecording) return;
        
//         try {
//             const stream = await navigator.mediaDevices.getUserMedia({
//                 audio: true,
//                 video: { width: 400, height: 300 } 
//             });
            
//             localStreamRef.current = stream;
            
//             if (localVideoRef.current) {
//                 localVideoRef.current.srcObject = stream;
//             }
            
//             // 1. Initialize MediaRecorder (using a common audio/video format)
//             const options = { mimeType: 'audio/webm; codecs=opus' }; 
//             mediaRecorderRef.current = new MediaRecorder(stream, options);
            
//             audioChunksRef.current = []; // Clear previous chunks
//             mediaRecorderRef.current.ondataavailable = (event) => {
//                 if (event.data.size > 0) {
//                     audioChunksRef.current.push(event.data);
//                 }
//             };
            
//             mediaRecorderRef.current.start();
            
//             setIsRecording(true);
//             setLogs(l => [...l, "Microphone and Camera started. Recording audio..."]);
//         } catch (err) {
//             setLogs(l => [...l, `Error accessing media: ${err.name} - Permission denied or device in use.`]);
//             console.error("Media access error:", err);
//             setIsRecording(false);
//         }
//     };
    
//     // --- FUNCTION: Stop Media and Send Audio ---
//     const stopLocalMediaAndSend = async () => {
//         if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;

//         // 1. Stop the recorder and the streams
//         mediaRecorderRef.current.stop();
//         localStreamRef.current.getTracks().forEach(track => track.stop());
//         localStreamRef.current = null;
        
//         setIsRecording(false);
//         setLogs(l => [...l, "Recording stopped. Preparing audio for server..."]);

//         // 2. Wait for the data to be fully collected and send it via WebSocket
//         mediaRecorderRef.current.onstop = () => {
//             const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            
//             // Use FileReader to convert Blob to Base64
//             const reader = new FileReader();
//             reader.readAsDataURL(audioBlob);

//             reader.onloadend = () => {
//                 const base64Data = reader.result.split(',')[1]; // Get only the Base64 part
                
//                 // 3. Send the Base64 audio data to the WebSocket
//                 ws.send(JSON.stringify({
//                     type: "audio_data", 
//                     question: currentQuestion.text,
//                     data: base64Data, 
//                     format: "webm" 
//                 }));
//                 setLogs(l => [...l, "Audio data sent to server for processing."]);
//             };
//         };
//     };
    
//     // --- Manual Stop Media (for cleanup/debug) ---
//     const stopLocalMedia = () => {
//         if (localStreamRef.current) {
//             localStreamRef.current.getTracks().forEach(track => track.stop());
//             localStreamRef.current = null;
//         }
//         if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
//             mediaRecorderRef.current.stop();
//         }
//         setIsRecording(false);
//         setLogs(l => [...l, "Microphone and Camera stopped."]);
//     };

//     // --- Clean-up media on component unmount ---
//     useEffect(() => {
//         return () => {
//             stopLocalMedia();
//         };
//     }, []);

//     // --- FUNCTION: START INTERVIEW & FETCH QUESTIONS ---
//     const startInterview = async () => {
//         if (!userId) {
//              setLogs(l => [...l, "Error: Cannot start interview. User ID is missing."]);
//              return;
//         }
//         try {
//             const token = getToken();
            
//             const startRes = await axios.post(`${API_BASE}/start_interview`, { user_id: userId }, {
//                 headers: { 'Authorization': `Bearer ${token}` }
//             });
//             setInterviewId(startRes.data.id);
//             setLogs(l => [...l, `New Interview started with ID: ${startRes.data.id}`]);

//             const questionsRes = await axios.get(`${API_BASE}/questions?level=1&limit=5`, {
//                 headers: { 'Authorization': `Bearer ${token}` }
//             });
            
//             const fetchedQuestions = questionsRes.data;
//             if (fetchedQuestions.length > 0) {
//                 setQuestions(fetchedQuestions);
//                 setQuestionIndex(0);
//                 setCurrentQuestion(fetchedQuestions[0]);
//                 setLogs(l => [...l, `Interview Started: ${fetchedQuestions.length} Questions Loaded`]);
                
//                 // Automatically start media upon loading the first question
//                 startLocalMedia(); 
//             } else {
//                 setLogs(l => [...l, "Error: No questions found in the database."]);
//             }
//         } catch (error) {
//             setLogs(l => [...l, "Error starting interview/fetching questions: " + (error.response?.statusText || error.message)]);
//         }
//     };

//     // --- FUNCTION: NEXT QUESTION ---
//     const nextQuestion = () => {
//         if (questionIndex < questions.length - 1) {
//             const nextIndex = questionIndex + 1;
//             setQuestionIndex(nextIndex);
//             setCurrentQuestion(questions[nextIndex]);
//             setLogs(l => [...l, `Moving to next question: ${questions[nextIndex].text.substring(0, 30)}...`]);
//             startLocalMedia(); // Restart media for the next answer
//         } else {
//             setCurrentQuestion({ text: "Interview Finished! Results sent for final review." });
//             setLogs(l => [...l, "Interview Finished! Check Profile for results."]);
//             setQuestions([]); 
//             stopLocalMedia(); // Stop media when interview ends
//         }
//     };
    
//     // --- RENDER ---
//     return (
//         <div className="card">
//             <h3>AI Interview Room</h3>

//             {/* VIDEO STREAM CONTAINER */}
//             <div className="video-container" style={{ textAlign: 'center', marginBottom: '15px' }}>
//                 <video 
//                     ref={localVideoRef} 
//                     autoPlay 
//                     muted 
//                     style={{ 
//                         width: '100%', 
//                         maxWidth: '400px', 
//                         height: 'auto', 
//                         aspectRatio: '4/3',
//                         background: '#000', 
//                         border: isRecording ? '2px solid #ff5555' : '1px solid #333' // Red border when recording
//                     }}
//                 >
//                 </video>
//             </div>
            
//             {!currentQuestion && questions.length === 0 && (
//                 <div style={{ textAlign: 'center' }}>
//                     <p>Ready to start your practice interview?</p>
//                     <button className="btn" onClick={startInterview}>
//                         Take Interview
//                     </button>
//                 </div>
//             )}

//             {currentQuestion && questions.length > 0 && (
//                 <>
//                     {/* --- FIX: Display Question Text with direct styling to ensure visibility --- */}
//                     <h4 style={{ color: 'white', marginTop: '20px', marginBottom: '20px', fontSize: '1.2em' }}>
//                         Question {questionIndex + 1} of {questions.length}: {currentQuestion.text}
//                     </h4>
                    
//                     <div className="controls">
//                         <button 
//                             className="btn" 
//                             // Call the function to STOP recording and SEND audio
//                             onClick={stopLocalMediaAndSend} 
//                             disabled={!ws || questionIndex >= questions.length || !isRecording}
//                         >
//                             {isRecording ? "Stop Recording & Submit" : "Processing..."}
//                         </button>
                        
//                         {/* Optional manual stop button for debugging streams */}
//                         <button 
//                             className="btn" 
//                             onClick={stopLocalMedia} 
//                             disabled={!isRecording}
//                             style={{ background: '#ff5555' }}
//                         >
//                             Stop All Media
//                         </button>
//                     </div>
//                 </>
//             )}

//             <div className="logs">
//                 {logs.map((l, i) => <div key={i} className="log-line">{l}</div>)}
//             </div>
//         </div>
//     );
// }

import React, { useEffect, useState, useRef } from "react";
import { getToken } from "../auth";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export default function InterviewRoom({ userId }) {
    const [ws, setWs] = useState(null);
    const [logs, setLogs] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [questionIndex, setQuestionIndex] = useState(0);
    const [interviewId, setInterviewId] = useState(null);

    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null);

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const [isRecording, setIsRecording] = useState(false);

    const roomId = `interview-${userId}`;

    // ---------------- LOGGING HELPER ----------------
    const appendLog = (msg) => {
        const line = `[${new Date().toISOString()}] ${msg}`;
        console.log(line);
        setLogs((prev) => [...prev, line]);
    };

    // ---------------- WEBSOCKET SETUP ----------------
    useEffect(() => {
        if (!userId) {
            appendLog("Error: User ID missing.");
            return;
        }

        const token = getToken();
        const w = new WebSocket(`ws://localhost:8000/ws/${roomId}?token=${token}`);

        w.onopen = () => appendLog("WebSocket connected.");
        w.onclose = () => appendLog("WebSocket disconnected.");
        w.onerror = () => appendLog("WebSocket error.");

        w.onmessage = (ev) => {
            const data = JSON.parse(ev.data);
            appendLog(`WS Message: ${JSON.stringify(data)}`);

            if (data.type === "evaluation") {
                alert(`Feedback received! Score: ${data.evaluation.combined_score}`);
                setTimeout(nextQuestion, 1500);
            } else if (data.type === "transcript_result") {
                appendLog(`Transcript: ${data.text}`);
            }
        };

        setWs(w);
        return () => w.close();
    }, [roomId, userId]);

    // ---------------- START MEDIA (UPDATED) ----------------
    const startLocalMedia = async () => {
        if (isRecording) {
            appendLog("Already recording.");
            return;
        }

        appendLog(`Requesting media devices. UA: ${navigator.userAgent}`);

        try {
            // Full stream for UI
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: { width: 400, height: 300 },
            });

            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            appendLog("Full media stream acquired.");

            // Extract AUDIO ONLY for recording
            const audioTracks = stream.getAudioTracks();
            const audioStream = new MediaStream(audioTracks);

            appendLog("Audio-only stream created for recorder.");

            // MIME fallback system
            let mime = "";
            if (MediaRecorder.isTypeSupported("audio/webm; codecs=opus")) {
                mime = "audio/webm; codecs=opus";
            } else if (MediaRecorder.isTypeSupported("audio/webm")) {
                mime = "audio/webm";
            }

            appendLog(`Selected MIME: ${mime || "(default)"}`);

            let recorder;
            try {
                recorder = mime
                    ? new MediaRecorder(audioStream, { mimeType: mime })
                    : new MediaRecorder(audioStream);
            } catch (err) {
                appendLog(`MediaRecorder failed with mime: ${err.message}`);
                return;
            }

            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.onerror = (e) =>
                appendLog("MediaRecorder error: " + e?.error?.message);

            recorder.onstart = () => appendLog("Recording started.");
            recorder.onstop = () => appendLog("Recording stopped.");

            recorder.start();
            mediaRecorderRef.current = recorder;

            setIsRecording(true);
            appendLog("Recording is active.");
        } catch (err) {
            appendLog("Media access error: " + err.message);
            console.error(err);
        }
    };

    // ---------------- STOP + SEND AUDIO (UPDATED) ----------------
    const stopLocalMediaAndSend = async () => {
        const mr = mediaRecorderRef.current;
        if (!mr) return appendLog("Recorder not found.");

        mr.onstop = () => {
            const blob = new Blob(audioChunksRef.current, {
                type: mr.mimeType || "audio/webm",
            });

            appendLog(`Final blob size: ${blob.size} bytes`);

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(",")[1];
                if (!ws || ws.readyState !== WebSocket.OPEN) {
                    appendLog("WS not open → cannot send.");
                    return;
                }

                ws.send(
                    JSON.stringify({
                        type: "audio_data",
                        question: currentQuestion.text,
                        data: base64,
                        format: mr.mimeType,
                    })
                );

                appendLog("Audio sent to server.");
            };

            reader.readAsDataURL(blob);

            mediaRecorderRef.current = null;
            audioChunksRef.current = [];
            setIsRecording(false);
        };

        mr.stop();
        appendLog("Stopped recorder.");

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
            appendLog("Camera + mic stopped.");
        }
    };

    // ---------------- STOP MEDIA (MANUAL) ----------------
    const stopLocalMedia = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            appendLog("Stopped local media.");
            localStreamRef.current = null;
        }
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }
        setIsRecording(false);
    };

    useEffect(() => {
        return () => stopLocalMedia();
    }, []);

    // ---------------- INTERVIEW LOGIC ----------------
    const startInterview = async () => {
        try {
            const token = getToken();
            const startRes = await axios.post(
                `${API_BASE}/start_interview`,
                { user_id: userId },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setInterviewId(startRes.data.id);

            appendLog(`Interview started. ID: ${startRes.data.id}`);

            const qRes = await axios.get(`${API_BASE}/questions?level=1&limit=5`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            setQuestions(qRes.data);
            setCurrentQuestion(qRes.data[0]);
            setQuestionIndex(0);

            appendLog("Questions loaded.");

            startLocalMedia();
        } catch (error) {
            appendLog("Interview start error: " + error.message);
        }
    };

    const nextQuestion = () => {
        if (questionIndex < questions.length - 1) {
            const next = questionIndex + 1;
            setQuestionIndex(next);
            setCurrentQuestion(questions[next]);
            appendLog("Next question loaded.");
            startLocalMedia();
        } else {
            appendLog("Interview finished.");
            setCurrentQuestion({ text: "Interview finished!" });
            stopLocalMedia();
        }
    };

    // ---------------- RENDER ----------------
    return (
        <div className="card">
            <h3>AI Interview Room</h3>

            <video
                ref={localVideoRef}
                autoPlay
                muted
                style={{
                    width: "100%",
                    maxWidth: "400px",
                    border: isRecording ? "2px solid red" : "1px solid gray",
                }}
            />

            {!currentQuestion && (
                <button className="btn" onClick={startInterview}>
                    Take Interview
                </button>
            )}

            {currentQuestion && (
                <>
                    <h4 style={{ color: "white" }}>
                        Question {questionIndex + 1}: {currentQuestion.text}
                    </h4>

                    <button
                        className="btn"
                        onClick={stopLocalMediaAndSend}
                        disabled={!isRecording}
                    >
                        Stop Recording & Submit
                    </button>
                </>
            )}

            <div className="logs">
                {logs.map((l, i) => (
                    <div key={i}>{l}</div>
                ))}
            </div>
        </div>
    );
}
