from fastapi.testclient import TestClient

from backend.main import app


def test_health():
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "gw-lab"


def test_root_serves_index():
    client = TestClient(app)
    # La raíz debe servir el HTML del sitio si existe
    response = client.get("/")
    assert response.status_code == 200
    # Verificamos que contiene el título esperado
    assert "GW Lab" in response.text or "waveform-canvas" in response.text
