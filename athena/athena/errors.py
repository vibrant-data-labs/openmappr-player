
class AthenaError(Exception):
    """base class for all athena exceptions"""
    pass

class AthenaMongoError(AthenaError):
	"""Class for all mongo related errors"""
	pass