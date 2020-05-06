import sys
from pathlib import Path
firstRunDone = Path(sys.path[0]+"/firstRunDone")
#print(firstRunDone)
if firstRunDone.is_file():
    print('All modules installed')
else:
    import os
    os.system("pip3 install mrjob nltk")
    import nltk
    nltk.download('stopwords')
    nltk.download('punkt')
    os.system("touch " + str(firstRunDone))
