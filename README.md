# TF-IDF MGIMO

MGIMO Student project designed to searh academic articles with TF-IDF Algorithm

## License

This project is licensed under MIT license. Take note, however, that some modules used in this project may be shared under a different license.

## Overall description

System for uploading academic articles in .PDF format, counting TF for each word & searching articles by ranking each word with TF-IDF algorithm

## Implementation & structure

### Implementation

System consists of two components:

1) Node.JS servers, that implement article upload & search. All I/O with client
2) Python-scripts, that count TF for every word in article.

Upon upload of an article to the server, it reads PDF, translates it into plain text and then provides the plain text file to python scripts. Python mrjob scripts then analyze the file and produce several files that are concatenated by Node js through the standard UNIX cat command into a single file, which is then parsed. Each word and its TF is then written to MongoDB, together with a copy of a file.

### Структура

#### С точки зрения порядка запуска

[] - Directory

+ app.js - entrypoint-script. Bootstraps all other Node.JS components
    - [./python/firstrun.py] - Makes sure all required python modules are installed and setup correctly
    - primary.js - Launches several worker-processes
        - productInfo.js - Product Info
        - database.js - Works with MongoDB and provides API interfaces to work with it
        - web.js - Launches web-server
            - [app]
                - [server]
                    - routes.js - HTTP router
                    - static.js - Static content server
                        - [subroutines]
                            - searchArticle.js - Article search
                            - uploadArticle.js - Article upload, parsing & processing
                                - [../../../python/] 
                                    - tf-idf.py - TF processing

#### From the file system view point

+ app.js
+ primary.js
+ database.js
+ web.js
+ package.json
+ package_lock.json
+ webpack.*.js
+ postcss.config.js
+ node_modules
    - Node js modules directory
+ app
    - server
        - routes.js
        - subroutines
            - searchArticle.js
            - uploadArticle.js
            - static.js
+ static (client js scripts, css & other static content. Have to be compiled before first launch)
    - js
    - css
    - img
+ src (Static content sources)
    - js
    - css
    - img
+ python
    - tf-idf.py
    - README.MD of original project
    - firstrun.py - installs required modules
