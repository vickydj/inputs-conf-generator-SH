from search_command import SearchCommand
import requests
import sys
import os
import json
import logging
import configparser

class pushpayload(SearchCommand):
    # def setup_logger(level):
    #     logger = logging.getLogger('input_conf_generator_sh')
    #     logger.setLevel(level)
    #     handler = logging.handlers.RotatingFileHandler(os.environ['SPLUNK_HOME']+'/var/log/splunk/input_conf_generator_sh.log', maxBytes=1000000, backupCount=5)
    #     formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    #     handler.setFormatter(formatter)
    #     logger.addHandler(handler)
    #     return logger
    
    def __init__(self, logger=None):
        super().__init__(run_in_preview=True, logger_name='input_conf_generator_sh')
        

    
    def handle_results(self,results, session_key, in_preview):
        self.output_results([{'Script status': "***** Initiated processing payload *****"}])

        self.output_results([{'Script status': "***** payload pushed, execution complete *****"}])



if __name__ == '__main__':
    pushpayload.execute()


