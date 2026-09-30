CREATE VENV: python3 -m venv venv source venv/bin/activate
INSTALL PKG :python3 -m pip install -r requirements.txt
RUN : python3 -m uvicorn app.main:app --reload --port 3400

source venv/bin/activate (access virtual env)
