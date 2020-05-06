#!/usr/bin/env python3
from mrjob.job import MRJob
from mrjob.step import MRStep
from mrjob.compat import jobconf_from_env
from mrjob.protocol import RawValueProtocol

from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize

from math import log

import sys
import os

import re
WORD_RE = re.compile(r"[\w']+")
SYM_PATTERN = r"[!\"#$%&()*+-./:;<=>?@\[\\\]^_`{|}~\n]"

stop_words = stopwords.words('english')
stop_words_russian = stopwords.words('russian')

NUMBER_OF_DOCUMENTS = 265

class MRTFIDF(MRJob):
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
			if word not in stop_words:
				if word not in stop_words_russian and len(word) > 1:
					yield word

	# => ((term, doc), 1)
	def get_words_from_line(self, _, line):
		fname = jobconf_from_env('map.input.file')
		# fname = os.environ['mapreduce_map_input_file']
		for term in self.splitter(line):
			yield (term, fname), 1

	# => ((term, doc), n)
	def term_frequency_per_doc(self, term_doc, occurences):
		term, doc = term_doc[0], term_doc[1]
		yield (term, doc), sum(occurences)

	def summarize(self, key, vals):
		yield key, sum(vals)

	# => docname, (word, n)
	def get_docs_tf(self, term_doc, freq):
		term, doc = term_doc[0], term_doc[1]
		yield term_doc[1], (term_doc[0], freq)

	# compute the total number of terms in each doc
	# => (term, doc), (tf, N)
	def number_of_terms_per_each_doc(self, doc, doc_term_freqs):
		terms = []
		freqs = []
		nwords = 0
		for term_freq in doc_term_freqs:
			term, freq = term_freq[0], term_freq[1]
			terms.append(term)
			freqs.append(freq)
			nwords += freq

		for i in range(len(terms)):
			yield (terms[i], doc), (freqs[i], nwords)

	# => term, (doc, tf, N, 1)
	def get_terms_per_corpus(self, term_doc, freq_docWords):
		term, doc = term_doc[0], term_doc[1]
		freq, nwords = freq_docWords[0], freq_docWords[1]
		yield term, (doc, freq, nwords, 1)

	# => (term, doc), (tf, N, number_of_docs)
	def term_appearence_in_corpus(self, term, doc_freq_nwords):
		number_of_docs = 0
		docs = []
		freqs = []
		nswords = []

		for dfn in doc_freq_nwords:
			number_of_docs += 1
			docs.append(dfn[0])
			freqs.append(dfn[1])
			nswords.append(dfn[2])

		for i in range(len(docs)):
			yield (term, docs[i]), (freqs[i], nswords[i], number_of_docs)

	# => (term, doc), tfidf
	def calculate_tf_idf(self, term_doc, tf_n_df):
		tfidf = (tf_n_df[0] / tf_n_df[1]) * log(NUMBER_OF_DOCUMENTS / tf_n_df[2])
		yield (term_doc[0], term_doc[1]), tfidf

	def steps(self):
		return [
			MRStep(
				mapper=self.get_words_from_line,
				combiner=self.term_frequency_per_doc,
				reducer=self.term_frequency_per_doc,
			),
			MRStep(
				mapper=self.get_docs_tf,
				reducer=self.number_of_terms_per_each_doc,
			),
			MRStep(
				mapper=self.get_terms_per_corpus,
				reducer=self.term_appearence_in_corpus,
			),
			MRStep(
				mapper=self.calculate_tf_idf,
			),
		]

if __name__ == '__main__':
	MRTFIDF.run()
