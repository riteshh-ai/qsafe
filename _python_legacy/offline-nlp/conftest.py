import sys
import os

# Add the offline-nlp root directory to sys.path so that
# `from src.engine import ...` works correctly when pytest is run
# from either the offline-nlp directory or the repo root.
sys.path.insert(0, os.path.dirname(__file__))
