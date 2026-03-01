import sys
sys.path.append(r"C:\Users\vladb\Desktop\proiecte\train-tracker\backend\cfr-iris-scraper")
from src.TrainPageGetter import get_train
import time
from concurrent.futures import ThreadPoolExecutor

trains = ["IR 1623", "IR 1833", "R 3005", "R 5003", "IC 538"]

start = time.time()

def fetch(t):
    try:
        res = get_train(t)
        # show a couple of useful fields
        delay = None
        if res:
            # take delay of last station
            delay = res.get('stations_data', [{}])[-1].get('delay')
        # also print coach_classes and station_options if available
        extra = {}
        if res:
            if res.get('coach_classes'):
                extra['classes'] = res['coach_classes']
            if res.get('station_options'):
                extra['stations'] = res['station_options'][:3]  # show first few
        return t, delay, res.get('services') if res else None, extra
    except Exception as e:
        return t, str(e), None
        
with ThreadPoolExecutor(max_workers=5) as ex:
    results = list(ex.map(fetch, trains))
    
print(f"Time taken: {time.time() - start:.2f}s")
for r in results:
    print(r)
