Currect functionality : 


Dashboard :

    Dashboard builds a payload from pre defined set of inputs from user inputs.
    Custom command invokes python to send payload to DS.

Setup page :

    This is user configurable from JS setup page.
    ds_info.conf is created with host, port and token.
    Token is clear text stored. 
    Encrypted in passwords.conf with password storage endpoint. (unread as of now)


Need to add : 

    Figure out how to communicate within docker between sh and ds
    Change from helloworld.py invoking to sendpayload.py
    1 custom source lists
    2 get list of UF from DS
    Read password from endpoint and remove from ds_info.conf


