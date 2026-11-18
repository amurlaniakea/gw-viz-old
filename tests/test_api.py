import pytest
from fastapi.testclient import TestClient

from backend.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_list_events(client):
    res = client.get("/api/events")
    assert res.status_code == 200
    assert "events" in res.json()


def test_event_detail(client):
    res = client.get("/api/events/GW150914")
    assert res.status_code == 200
    assert res.json()["id"] == "GW150914"


def test_strain_data(client):
    res = client.get("/api/events/GW150914/strain")
    assert res.status_code == 200
    data = res.json()
    assert len(data) > 100
    assert "t" in data[0] and "h" in data[0]
