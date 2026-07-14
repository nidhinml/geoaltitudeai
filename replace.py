import os
import re

target_dir = r'f:\Geoaltitude_ai\frontend\src'
target_string = "'http://127.0.0.1:8000/api'"
replacement_string = "(import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api')"

for root, _, files in os.walk(target_dir):
    for file in files:
        if file.endswith('.tsx') or file.endswith('.ts'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            
            # Replace exact const API_BASE definitions
            new_content = new_content.replace(target_string, replacement_string)
            
            # Replace explainability explicitly
            new_content = new_content.replace("'http://127.0.0.1:8000/api/explainability'", "`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/explainability`")
            
            # Replace inline fetches like fetch('http://127.0.0.1:8000/api/health')
            new_content = re.sub(r"'http://127\.0\.0\.1:8000/api/(.*?)'", r"`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'}/\1`", new_content)
            
            if content != new_content:
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f'Updated {filepath}')
