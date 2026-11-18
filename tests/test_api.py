from fastapi.testclient import TestClient

from backend.main import app


def test_health():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "gw-lab"


def test_root_serves_new_lab_ui():
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    
    # El nuevo HTML debe contener el canvas y el título GW Laboratory
    text = response.text
    assert "GW Laboratory" in text or "🔬 GW Laboratory" in text
    assert "waveform-canvas" in text
    assert "slider-m1" in text
