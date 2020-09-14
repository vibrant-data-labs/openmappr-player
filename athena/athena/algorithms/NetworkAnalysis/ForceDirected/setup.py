# -*- coding: utf-8 -*-

import sys
import numpy
from distutils.core import setup
from distutils.extension import Extension
from Cython.Distutils import build_ext

DESCRIPTION = 'Fast C++ BHTree for python force directed layout'

if sys.platform == 'darwin':
    ext_modules = [Extension(
                   name='bhtree',
                   sources=['BHTreeLib/BHTreeLib/BHTreeNode.cpp', 'bhtree.pyx'],
                   include_dirs=[numpy.get_include(), 'BHTreeLib/BHTreeLib', '/usr/local/include'],
                   extra_compile_args=['-I/System/Library/Frameworks/vecLib.framework/Headers', '-mmacosx-version-min=10.7', '-std=c++11', '-stdlib=libc++'],
                   extra_link_args=['-Wl,-framework', '-Wl,Accelerate'],
                   language='c++')]
else:
    ext_modules = [Extension(
                   name='bhtree',
                   sources=['BHTreeLib/BHTreeLib/BHTreeNode.cpp', 'bhtree.pyx'],
                   include_dirs=[numpy.get_include(), 'BHTreeLib/BHTreeLib', '/usr/local/include'],
                   library_dirs=['/usr/local/lib'],
                   extra_compile_args=['-std=c++11', '-msse2', '-O3', '-fPIC', '-w'],
                   extra_link_args=[],
                   language='c++')]

#               extra_compile_args=['-std=c++11', '-stdlib=libc++'],

setup(
    name='bhtree',
    version='0.1',
    maintainer='Rich Williams',
    maintainer_email='rich&mappr.io',
    packages=['bhtree'],
    ext_modules=ext_modules,
    description=DESCRIPTION,
    license='BSD',
    cmdclass={'build_ext': build_ext}
    # ,
    # install_requires=[
    #     'Cython>=0.19.1',
    #     'numpy>=1.7.1',
    #     'scipy>=0.12.0'
    # ]
)
