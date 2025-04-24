# utils.py

def split_file_into_chunks(file_content, max_chunk_tokens=5000):
    lines = file_content.split('\n')
    chunks = []
    current_chunk = ""

    for line in lines:
        if len(current_chunk.split()) + len(line.split()) < max_chunk_tokens:
            current_chunk += line + "\n"
        else:
            chunks.append(current_chunk)
            current_chunk = line + "\n"

    if current_chunk.strip():
        chunks.append(current_chunk)
    return chunks

