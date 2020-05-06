#!/usr/bin/env python3
from mrjob.job import MRJob
from mrjob.step import MRStep
from mrjob.compat import jobconf_from_env
from mrjob.protocol import JSONProtocol, RawValueProtocol

from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

from math import log

import re
WORD_RE = re.compile(r"[\w']+")
SYM_PATTERN = r"[!\"#$%&()*+-./:;<=>?@\[\\\]^_`{|}~\n]"

stop_words = stopwords.words('english')

NUMBER_OF_DOCUMENTS = 265

import sys

def eprint(*args, **kwargs):
	print(*args, file=sys.stderr, **kwargs)


class MRTFIDF(MRJob):
	def __init__(self, *args, **kwargs):
		super(MRTFIDF, self).__init__(*args, **kwargs)
		self.terms_of_search = ["sre", "is", "my", "life"]

	"""Method splitter gets raw line and yields sanitiezed words"""
	def splitter(self, line):
		# replaces all syymbols with single space
		line = re.sub(SYM_PATTERN, ' ', line)
		# replaces multiple spaces with single one
		line = re.sub(r"(\s+)", line, ' ')
		# replaces comma with nothing
		line = re.sub(",", '', line)
		# removes appostrophe
		line = re.sub("'", '', line)
		for word in word_tokenize(str(line.lower())):
			if word not in stop_words and len(word) > 1:
				yield word

	def configure_args(self):
		super(MRTFIDF, self).configure_args()
		self.add_passthru_arg(
			'--search-string', default='',
			help="Specify the search string")


	INPUT_PROTOCOL = JSONProtocol

	# => term, (doc, tfidf) (only for terms in search string)
	def get_search_terms(self, term_doc, tfidf):
		yield (term_doc[0]), (term_doc[1], tfidf)

	def parse_args(self):
		self.terms_of_search = [ term for term in self.splitter(self.options.search_string) ]

	def filter_by_search(self, term, doc_tfidf):
		if term in self.terms_of_search:
			for dtfidf in doc_tfidf:
				yield term, dtfidf

	def reducer_init(self):
		self.parse_args()
		self.by_term = {}
		for term in self.terms_of_search:
			self.by_term[term] = []

	# => (term, doc)
	def build_listing_of_documents(self, term, doc_tfidf):
		self.by_term[term] = sorted(doc_tfidf, key=lambda dtfidf: -dtfidf[1])[0:10]

	# OUTPUT_PROTOCOL = RawValueProtocol
	def finalize_search(self):
		docs = {}

		for term in self.by_term:
			for doc in self.by_term[term]:
				if not doc[0] in docs:
					docs[doc[0]] = 0

				docs[doc[0]] += doc[1]

		ldocs = sorted([ (doc, docs[doc]) for doc in docs ], key=lambda item: -item[1])
		for doc_score in ldocs:
			yield doc_score[0], doc_score[1]

	def steps(self):
		return [
			MRStep(
				mapper=self.get_search_terms,
				combiner=self.filter_by_search,
				combiner_init=self.parse_args,
				reducer=self.build_listing_of_documents,
				reducer_init=self.reducer_init,
				reducer_final=self.finalize_search,
			)
		]

if __name__ == '__main__':
	MRTFIDF.run()
