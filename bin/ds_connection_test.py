import sys
import os
import requests
import configparser
import socket
import logging
from logging import handlers


def setup_logger(level):
    logger = logging.getLogger('input_conf_generator_ping_test')
    logger.setLevel(level)
    handler = logging.handlers.RotatingFileHandler(os.environ['SPLUNK_HOME']+'/var/log/splunk/input_conf_generator_ping_test.log', maxBytes=1000000, backupCount=5)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger

logger = setup_logger(logging.DEBUG)

def if_conf_exists(config_file):
    
    if os.path.exists(config_file):
        logger.debug(f"Config file exists: {config_file}")
        return True
    else:
        logger.error(f"Config file does not exist: {config_file}")
        return False

def read_splunk_config_ds_url(config_file):
    config = configparser.ConfigParser()
    
    config.read(config_file)
    logger.debug(f"Reading config file: {config_file}")
    ds_host = config.get('properties', 'ds_host')
    ds_mgmt_port = config.getint('properties', 'ds_mgmt_port')
    ds_token = config.get('properties', 'ds_token')
    logger.debug(f"ds_host: {ds_host}, ds_mgmt_port: {ds_mgmt_port}")
    
    if ds_host and ds_mgmt_port and ds_token:
        return ds_host, ds_mgmt_port, ds_token
    else:
        logger.error("One or more values are missing")
        return None, None, None


def test_ds_connection(config_file):
    ds_host, ds_mgmt_port, ds_token = read_splunk_config_ds_url(config_file)

    if ds_host and ds_mgmt_port and ds_token:
        
        
        ds_url = f"https://{ds_host}:{ds_mgmt_port}/services/apps/local"
        headers = {
            'Authorization': f'Bearer {ds_token}'
        }
        try:
            response = requests.get(ds_url, headers=headers, verify=False)
            logger.debug(f"response: {response}")
            
            if response.status_code == 200:
                logger.info("Success: The request was successfully completed.")
                return True
            elif response.status_code == 404:
                logger.warning("Warning: The requested resource could not be found (404).")
                return False
            elif response.status_code == 500:
                logger.error("Error: The server encountered an internal error (500).")
                return False
            else:
                logger.error(f"Error: Unexpected status code: {response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            logger.error(f"Error making request: {str(e)}")
            return False
    else:
        logger.error("Missing configuration values")
        return False
        

if __name__ == "__main__":
    
    config_file = os.path.join(os.environ['SPLUNK_HOME'], 'etc', 'apps', 'input_conf_generator_sh', 'local', 'ds_info.conf')
    if if_conf_exists(config_file):
        if test_ds_connection(config_file):
            logger.debug("Splunk DS connection is successful")
        else:
            logger.error("Splunk DS connection Failed")
    else:
        logger.error("Splunk DS connection Failed")
