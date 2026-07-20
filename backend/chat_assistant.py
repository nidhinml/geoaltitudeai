from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
import os
from openai import AsyncOpenAI

chat_router = APIRouter(prefix="/api", tags=["Chat Assistant"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: str = "meta/llama-3.1-8b-instruct"
    temperature: float = 0.5
    top_p: float = 1.0
    max_tokens: int = 1024
    frequency_penalty: float = 0.0
    presence_penalty: float = 0.0
    seed: Optional[int] = None

class ChatResponse(BaseModel):
    response: str
    model_used: str

from fastapi.responses import StreamingResponse

@chat_router.post("/chat")
async def chat_with_assistant(request: ChatRequest):
    api_key = os.environ.get("NVIDIA_API_KEY")
    
    if not api_key:
        async def fallback_stream():
            yield "⚠️ **NVIDIA API Key Missing**\n\nTo use the AI Assistant, please set your `NVIDIA_API_KEY` environment variable."
        return StreamingResponse(fallback_stream(), media_type="text/plain")
        
    try:
        client = AsyncOpenAI(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key=api_key,
            timeout=15.0 # Prevent infinite hanging
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

        async def event_stream():
            try:
                completion = await client.chat.completions.create(
                    model=request.model,
                    messages=messages,
                    temperature=request.temperature,
                    top_p=request.top_p,
                    max_tokens=request.max_tokens,
                    frequency_penalty=request.frequency_penalty,
                    presence_penalty=request.presence_penalty,
                    seed=request.seed,
                    stream=True
                )
                async for chunk in completion:
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
