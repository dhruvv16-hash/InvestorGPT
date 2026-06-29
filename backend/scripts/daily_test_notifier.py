import subprocess
import requests
import os
import sys

# Dynamic URL configuration (fallbacks to a mock or test endpoint if not set)
WEBHOOK_URL = os.getenv("ERROR_ALERT_WEBHOOK_URL", "")

def run_daily_tests():
    print("Executing daily platform health test runs...")
    
    # Execute pytest test suite in the root directory
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--tb=short"], 
        cwd="E:/InvestorGPT", 
        capture_output=True, 
        text=True
    )
    
    print(f"Test Run Exit Code: {result.returncode}")
    
    if result.returncode != 0:
        # Failure detected: format alert content
        error_output = result.stdout + "\n" + result.stderr
        truncated_errors = error_output[-1500:] # cap to prevent exceeding webhook payload limits
        
        print("[FAIL] Test failure detected! Dispatching alerting payload...")
        print(truncated_errors)
        
        if WEBHOOK_URL:
            payload = {
                "username": "InvestorGPT Monitoring Daemon",
                "content": f"InvestorGPT Daily Integration Failure Alert\n"
                           f"Failed test case outputs:\n"
                           f"```\n{truncated_errors}\n```\n"
                           f"Please review backend cache databases and yfinance supplier connectivity."
            }
            try:
                res = requests.post(WEBHOOK_URL, json=payload, timeout=5)
                print(f"Webhook Notification Response Status: {res.status_code}")
            except Exception as e:
                print(f"Failed to post alert webhook: {e}")
        else:
            print("Notice: ERROR_ALERT_WEBHOOK_URL is not configured. Alert was printed to console logs instead.")
        return False
        
    print("[SUCCESS] All test runs passed successfully.")
    return True

if __name__ == "__main__":
    run_daily_tests()
