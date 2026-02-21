import sys
sys.path.append(r"C:\Users\vladb\Desktop\proiecte\train-tracker\backend\cfr-iris-scraper")
from src.TrainPageGetter import get_real_train_data
import time
from concurrent.futures import ThreadPoolExecutor

trains = ["IR 1623", "IR 1833", "R 3005", "R 5003", "IC 538"]

start = time.time()

def fetch(t):
    try:
        res = get_real_train_data(t)
        return t, res.get('delay', 0) if res else 0
    except Exception as e:
        return t, str(e)
        
with ThreadPoolExecutor(max_workers=5) as ex:
    results = list(ex.map(fetch, trains))
    
print(f"Time taken: {time.time() - start:.2f}s")
for r in results:
    print(r)
