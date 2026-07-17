from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import os
from openai import OpenAI

chat_router = APIRouter(prefix="/api/chat", tags=["Chat Assistant"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: str = "meta/llama-3.1-8b-instruct"

class ChatResponse(BaseModel):
    response: str
    model_used: str

from fastapi.responses import StreamingResponse

@chat_router.post("")
def chat_with_assistant(request: ChatRequest):
    api_key = os.environ.get("NVIDIA_API_KEY")
    
    if not api_key:
        def fallback_stream():
            yield "⚠️ **NVIDIA API Key Missing**\n\nTo use the AI Assistant, please set your `NVIDIA_API_KEY` environment variable."
        return StreamingResponse(fallback_stream(), media_type="text/plain")
        
    try:
        client = OpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key
        )
        
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        
        if not any(m["role"] == "system" for m in messages):
            # Load the complete knowledge base from the markdown file
            knowledge_path = os.path.join(os.path.dirname(__file__), "geo_ai_knowledge.md")
            try:
                with open(knowledge_path, "r", encoding="utf-8") as f:
                    system_content = f.read()
            except Exception:
                system_content = "You are Geo Ai. Knowledge base file missing."

            system_prompt = {
                "role": "system",
                "content": system_content
            }
            messages.insert(0, system_prompt)

        def event_stream():
            try:
                completion = client.chat.completions.create(
                    model=request.model,
                    messages=messages,
                    temperature=0.5,
                    top_p=1,
                    max_tokens=1024,
                    stream=True
                )
                for chunk in completion:
                    if hasattr(chunk, 'choices') and len(chunk.choices) > 0:
                        if chunk.choices[0].delta.content is not None:
                            yield chunk.choices[0].delta.content
            except Exception as e:
                yield f"\n\n**Error during streaming**: {str(e)}"

        return StreamingResponse(
            event_stream(), 
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no" # For Nginx if used
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to communicate with NVIDIA NIM: {str(e)}")
