import os
import sys
import logging.handlers
import json
import requests
from urllib3.exceptions import InsecureRequestWarning
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

def setup_logger(level):
    logger = logging.getLogger('_request_reload_srv_class')
    logger.setLevel(level)
    handler = logging.handlers.RotatingFileHandler(os.environ['SPLUNK_HOME']+'/var/log/splunk/_request_reload_srv_class.log', maxBytes=1000000, backupCount=5)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger

logger = setup_logger(logging.DEBUG)

try:
    ds_host = "ds1"
    ds_mgmt_port = "8089"
    ds_token = "eyJraWQiOiJzcGx1bmsuc2VjcmV0IiwiYWxnIjoiSFM1MTIiLCJ2ZXIiOiJ2MiIsInR0eXAiOiJzdGF0aWMifQ.eyJpc3MiOiJhZG1pbiBmcm9tIGRzMSIsInN1YiI6ImFkbWluIiwiYXVkIjoiaW5wdXRzX2NvbmZfZ2VuZXJhdG9yIiwiaWRwIjoiU3BsdW5rIiwianRpIjoiNjQ1MzdlZjRlMDZiMzJlMDhmNDc0OTAxOTAxY2E3ZGFhYmEzODljNjk2NDIzYWVjYTE1YTc4ZTBiM2QxZjlkOSIsImlhdCI6MTczMTAxODAwMiwiZXhwIjoxNzMzNjEwMDAyLCJuYnIiOjE3MzEwMTgwMDJ9.zaZMWGm5slG138NohaDna8Bjv150xMuDzSs2ZBOmGp7Q8cAxeal7DTzX6eHls5K8-QFy10eebBJfLGCSMDdJkQ"
    sc = "beta_my_app1_2_3_idx_my_st"

    url = f'https://{ds_host}:{ds_mgmt_port}/services/deployment/server/config/_reload'
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Splunk {ds_token}'
    }
    
    logger.debug(f"header - with auth token: {headers}")
    params = {'output_mode': 'json'}
    
    try:
        logger.debug(f"Posting to URL: {url}")
        response = requests.post(
            url,
            headers=headers,
            json={'serverclass': sc},  # Format payload as a dictionary
            params=params,
            verify=False
        )
        response.raise_for_status()
        logger.debug(f"Response from DS: {response.json()}")
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Request failed: {str(e)}")
        print(f"Request failed: {str(e)}")
        
except Exception as e:
    logger.error(f"An error occurred: {str(e)}")
    print(f"An error occurred: {str(e)}")
