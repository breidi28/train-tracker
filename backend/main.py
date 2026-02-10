from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/trains")
def get_trains(from_station: str, to_station: str):
    try:
        trains = search_trains(from_station, to_station)
        return trains
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
