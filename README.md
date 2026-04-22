# ETF Tracker

Web app per il tracking di portafogli ETF, costruita con Flask + HTML/CSS/JS.

## Stack
- **Backend**: Python 3.11 + Flask
- **Frontend**: HTML5, CSS3, JavaScript vanilla + Chart.js
- **Deploy**: Render (free tier)

## Avvio locale
```bash
pip install -r requirements.txt
python app.py
```
Apri http://localhost:5000

## Deploy su Render
1. Pusha su GitHub
2. Crea un nuovo Web Service su render.com
3. Collega il repo → Build: `pip install -r requirements.txt`
4. Start: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2`
5. Aggiungi env var: `SECRET_KEY` (genera automaticamente)
