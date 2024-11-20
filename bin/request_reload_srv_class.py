import configparser
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
    # handler = logging.handlers.RotatingFileHandler('request_reload_srv_class.log', maxBytes=1000000, backupCount=5)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger

logger = setup_logger(logging.DEBUG)

def read_splunk_config_ds_url():
    config = configparser.ConfigParser()
    config_file = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps', 'input_generator_dashboard_sh','local' ,'ds_info.conf')
    config.read(config_file)
    logger.debug(f"Reading config file: {config_file}")
    ds_host = config.get('properties', 'ds_host')
    ds_mgmt_port = config.getint('properties', 'ds_mgmt_port')
    ds_token = config.get('properties', 'ds_token')
    logger.debug(f"ds_host: {ds_host}, ds_mgmt_port: {ds_mgmt_port}")
    return ds_host, ds_mgmt_port, ds_token


def request_ds_reload():
    ds_host, ds_mgmt_port, ds_token = read_splunk_config_ds_url()
    try:
        url = f'https://{ds_host}:{ds_mgmt_port}/services/deployment/server/config/_reload?output_mode=json'
        logger.debug(f"DS reload endpoint: {url}")

        payload = ""
        headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Splunk {ds_token}'
        }

        response = requests.request("POST", url, headers=headers, data=payload, verify=False)

        logger.debug(f"response: {response.text}")
        logger.debug(f"response code: {response.status_code}")
        return response.status_code
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Error reloading DS: {str(e)}", exc_info=True)
        return False
    
if __name__ == '__main__':
    try:
        logger.info("Script started")
        logger.debug(f"sys.argv: {sys.argv}")
        request_ds_reload()
    except Exception as e:
        error_message = f"Error in script execution: {str(e)}"
        logger.error(error_message, exc_info=True)
        sys.exit(1)
        


