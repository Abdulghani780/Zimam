FROM python:3.12-slim
WORKDIR /app
COPY control_plane/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt
COPY control_plane /app/control_plane
COPY dist /app/frontend/dist
ENV PYTHONPATH=/app/control_plane
EXPOSE 8876
CMD ["uvicorn", "zimam_control.app:app", "--host", "0.0.0.0", "--port", "8876"]
