#python program to check if there is a file in disk with specific contents
import os
import sys
import logging
import re
from datetime import datetime
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_file_contents(file_path, expected_contents):
    try:
        if not os.path.exists(file_path):
            logger.info(f"File not found: {file_path}")
            return False

        with open(file_path, 'r') as file:
            content = file.read()

        for key, expected_value in expected_contents.items():
            pattern = rf'{key}\s*=\s*{re.escape(expected_value)}'
            if not re.search(pattern, content):
                logger.info(f"File {file_path} does not contain expected content for key {key}")
                return False

        logger.info(f"File {file_path} contains all expected contents")
        return True

    except Exception as e:
        logger.error(f"Error checking file contents: {str(e)}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        logger.error("Usage: python check_file_contents.py <file_path> <key1=value1> <key2=value2> ...")
        sys.exit(1)

    file_path = sys.argv[1]
    expected_contents = {arg.split('=')[0]: arg.split('=')[1] for arg in sys.argv[2:]}

    if check_file_contents(file_path, expected_contents):
        logger.info("All expected contents found in the file.")
        sys.exit(0)
    else:
        logger.error("Not all expected contents found in the file.")
        sys.exit(1)