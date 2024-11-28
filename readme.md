# input_conf_generator_sh 

This app only works if the ds app is installed <app name>. without either of them, the functionality is broken.

## Current functionality : 


Dashboard :

• Dashboard builds a json payload from pre defined set of inputs from user inputs. (LIMITED FUNCTIONALITY AS OF NOW)

• Dashboard calls Custom command which invokes python to send payload to DS. If js could do this, alternatively i could use that as primary invoking method.

## Setup page : done over js 

• This is user configurable from JS setup page.

• ds_info.conf is created with host, port and token.

• Token is stored as clear text in ds_info.conf

• Encrypted in passwords.conf with password storage endpoint. (unread as of now)



## Need to add : 

Essentials: cannot go live before these are done

### Permissions :
• Setup page to be viewed only by admins.

• Dashboard to be viewed by power users. Optional.

### Broken Functionality :
• ~~Figure out how to communicate within docker between sh and ds. I think this worked atleast once, but not now~~

### Renaming and public ready :
• ~~Change from helloworld.py invoking to sendpayload.py~~

• ~~Change from my_rest custom endpoint to receivejsonfromsh and respective python file~~

### New Functionality :
• Dashboard or js to get custom source lists from users.

• Ability to mention source and host list in a format. Preferably done over js snippet.

• Perform basic json payload validations on sh and ds. Check for host and source formatting.

~~Add cron field to setup page js - store in ds_info.conf ( try to add this to inputs.conf - scripted inputs)~~

### can go live without this but essential 
nothing here

## Feature enhancements:

• Get list of UF from DS, read token from ds_info.conf

• Add username to payload. And add in inputs.conf.

• Read password from endpoint and remove from ds_info.conf

• Populate setup page if configured.

• replicate the dashboard with a js script page to generate payload.

• Add validations to setup page.

• Add validations to payload generation page.


   



