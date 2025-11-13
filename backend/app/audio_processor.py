import base64
import tempfile
import os
import subprocess
import asyncio
import io
import wave
import numpy as np

# Import functions from other modules
from .config import settings
from .ai_evaluator import evaluate_answer_with_gemini
from .speech_google import transcribe_audio_google 
from .opensmile_integration import extract_opensmile_features

# NOTE: This function requires FFMPEG to be installed and available in the system PATH
# to convert the incoming webm audio (from the browser) to wav format.
async def webm_to_wav_ffmpeg(webm_path, wav_path):
    """Converts webm audio file to 16kHz mono WAV using FFMPEG."""
    # FFMPEG command: input, sample rate (16k required by Google STT), channels (mono), output format, output path
    command = [
        'ffmpeg', '-i', webm_path, 
        '-acodec', 'pcm_s16le', '-ac', '1', '-ar', '16000', 
        wav_path
    ]
    
    # Run FFMPEG command asynchronously
    proc = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await proc.communicate()
    
    if proc.returncode != 0:
        raise RuntimeError(f"FFMPEG conversion failed (Error Code: {proc.returncode}): {stderr.decode()}")
        
    print(f"FFMPEG Conversion successful: {wav_path}")
    return wav_path

async def process_audio_and_evaluate(room_id: str, question: str, base64_audio: str, manager):
    tmp_webm_path = None
    tmp_wav_path = None
    
    try:
        # 1. Convert Base64 audio to a temporary WebM file
        audio_data = base64.b64decode(base64_audio)
        tmp_webm_path = tempfile.NamedTemporaryFile(delete=False, suffix=".webm").name
        with open(tmp_webm_path, "wb") as f:
            f.write(audio_data)

        # 2. Convert WebM to WAV (REQUIRED for Google STT and OpenSMILE)
        tmp_wav_path = tempfile.NamedTemporaryFile(delete=False, suffix=".wav").name
        
        # --- Crucial step using FFMPEG ---
        await webm_to_wav_ffmpeg(tmp_webm_path, tmp_wav_path)
        
        manager.broadcast(room_id, {"type":"status", "message": "Audio converted to WAV. Starting transcription..."})


        # 3. Transcribe Audio using Google STT
        transcript_text = transcribe_audio_google(tmp_wav_path)
        manager.broadcast(room_id, {"type":"transcript_result", "text": transcript_text})

        # 4. Extract OpenSMILE Features (Simulated for feedback enhancement)
        try:
            # This requires OpenSMILE to be installed and configured
            opensmile_csv_path = extract_opensmile_features(tmp_wav_path)
            # In a real app, you would read the CSV and calculate a metric here
            smile_result = "Acoustic features extracted successfully (check console)."
            os.remove(opensmile_csv_path) # Clean up CSV
        except FileNotFoundError:
            smile_result = "Acoustic analysis skipped: OpenSMILE path not found."
        except Exception as e:
            smile_result = f"Acoustic analysis error: {e}"


        # 5. Evaluate the transcript using Gemini
        eval_res = await evaluate_answer_with_gemini(question, transcript_text)

        # Enhance feedback with acoustic analysis status
        eval_res['feedback'] = f"[Acoustic Status: {smile_result}] " + eval_res['feedback']
        
        # 6. Broadcast results
        await manager.broadcast(room_id, {"type":"evaluation","evaluation":eval_res})

    except Exception as e:
        error_msg = f"Full Processing Pipeline Failed: {e}"
        print(f"ERROR: {error_msg}")
        await manager.broadcast(room_id, {"type":"error", "message": error_msg})
    finally:
        # Clean up temporary files
        if tmp_webm_path and os.path.exists(tmp_webm_path): os.remove(tmp_webm_path)
        if tmp_wav_path and os.path.exists(tmp_wav_path): os.remove(tmp_wav_path)