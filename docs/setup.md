# Setup Guide

## Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Backend

```bash
cd backend
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

---

## CV

```bash
cd cv
pip install opencv-python mediapipe
```