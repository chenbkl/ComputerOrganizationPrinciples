from dotenv import load_dotenv
import os

load_dotenv(verbose=True)
PicovoiceAccessKey = os.getenv("PicovoiceAccessKey")
print("PicovoiceAccessKey:"+PicovoiceAccessKey)