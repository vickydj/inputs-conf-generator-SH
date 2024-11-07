import sys
import os
import splunk.Intersplunk
import json
import logging
import requests
import configparser

def setup_logger(level):
    logger = logging.getLogger('_send_payload_to_ds')
    logger.setLevel(level)
    handler = logging.handlers.RotatingFileHandler(os.environ['SPLUNK_HOME']+'/var/log/splunk/_send_payload_to_ds.log', maxBytes=1000000, backupCount=5)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    return logger

logger = setup_logger(logging.DEBUG)

def getinfo():
    return {
        'args': ['msg'],
        'description': 'Sends payload to configured DS in a predefined format. This payload is process by another application to generate configs.',
        'streaming': True
    }

#function to read splunk config file
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

def parse_args(results, keywords, argvals):
    logger.debug(f"Parsing keywords: {keywords}, argvals: {argvals}")

    # Get the first result (assuming there's at least one)
    if results:
        result = results[0]
        if 'payload' in result:
            json_string = result['payload']
            try:
                # Parse the JSON string
                return json.loads(json_string)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON: {json_string}")
            logger.error(f"JSON decode error: {str(e)}")

def post_to_ds(dashboard_payload):
    ds_host, ds_mgmt_port, ds_token = read_splunk_config_ds_url()
    
    
    url = f'https://{ds_host}:{ds_mgmt_port}/servicesNS/-/input_config_gen_endpoints_ds/my_rest'
    headers = {'Content-Type': 'application/json',
               'Authorization': f'Splunk {ds_token}'
               }
    
    
    logger.debug(f"header - with auth token: {headers}")
    params = {'output_mode': 'json'}
    try:
        logger.debug(f"Posting to URL: {url}")
        response = requests.post(
            url,
            headers=headers,
            json={'payload': json.dumps(dashboard_payload)},
            params=params,
            verify=False
        )
        response.raise_for_status()
        logger.debug(f"Response from DS: {response.json()}")
        return True
    except requests.exceptions.RequestException as e:
        logger.error(f"Error sending payload to DS: {str(e)}", exc_info=True)
        return False

def stream(results, keywords, argvals):
    logger.info("Stream function called")
    logger.debug(f"Input results: {results}")
    try:
        dashboard_payload = parse_args(results, keywords, argvals)
        logger.debug(f"Sent payload: {post_to_ds(dashboard_payload)}")
        # dashboard_payload = json.dumps(dashboard_payload, indent=2)
        logger.debug(f"Message dashboard_payload : {dashboard_payload}")

        yield {
            'payload': f"dashboard_payload: {dashboard_payload}",
            'status': 200
        }
        splunk.Intersplunk.outputResults([    {"_raw": "payload sent successfully"}])

    except Exception as e:
        logger.error(f"Error in stream function: {str(e)}", exc_info=True)
        raise

if __name__ == '__main__':
    try:
        logger.info("Script started")
        logger.debug(f"sys.argv: {sys.argv}")
        
        if len(sys.argv) > 1 and (sys.argv[1] == '--getinfo' or sys.argv[1] == '__GETINFO__'):
            logger.info(json.dumps(getinfo()))
            print(json.dumps(getinfo()))
            logger.info("Getinfo executed successfully")
        else:
            logger.info("Executing command in streaming mode")
            results, dummyresults, settings = splunk.Intersplunk.getOrganizedResults()
            keywords, argvals = splunk.Intersplunk.getKeywordsAndOptions()
            streaming_results = list(stream(results, keywords, argvals))
            logger.debug(f"Streaming_results : {streaming_results}")

            # splunk.Intersplunk.outputResults("output to splunk test")
            # splunk.Intersplunk.outputResults(streaming_results)
    except Exception as e:
        error_message = f"Error in script execution: {str(e)}"
        logger.error(error_message, exc_info=True)
        sys.exit(1)
