# Use the official Python 3.10 image from Docker Hub
FROM python:3.10-slim

# Set the working directory inside the container
WORKDIR /app

# Create necessary directories for the backend
RUN mkdir -p /app/data/models /app/uploads

# Install system dependencies required for XGBoost and spatial calculations
RUN apt-get update && apt-get install -y \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file first for caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend application code
COPY . .

# Expose port 7860, which is specifically required by Hugging Face Spaces
EXPOSE 7860

# Command to run the FastAPI application on port 7860
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
