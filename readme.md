# input_conf_generator_sh 

This app only works if the peer - ds app is installed <app name>, and set up page is configured with details of the DS Without either of them, the functionality is broken.

## Current functionality : 


### Self-service form 

- Admins will need to generate an auth token from DS and configure the setup page with required details.
  
- Dashboard builds a json payload from user inputs. 

- Dashboard calls custom command which invokes python to send payload to DS.

- Store the payload in a text file, for reference.

### Setup page

- This is admin configurable from JS setup page.

- ds_info.conf is created with host, port and token.

- Token is stored as clear text in ds_info.conf

- Encrypted in passwords.conf with password storage endpoint. (unread as of now)


## Feature enhancements:

• Get list of UF from DS, read token from ds_info.conf

• Add username to payload. And add in inputs.conf.

• Read password from endpoint and remove from ds_info.conf

• Populate setup page if configured.

• replicate the dashboard with a js script page to generate payload.

• Add validations to setup page.

• Add validations to payload generation page.


   



