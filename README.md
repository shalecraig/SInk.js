jQuery Sync
===========

A plugin to provide asynchronous object-passing between tabs.


For reals, yo.


The source code has much more information contained in comments at the top.


Tested & compatible with:

> Chrome 15

> Firefox 5 - 6

> Safari 5.1


localStorage.clear() is not supported in the tab that it is called from. When the index of tabs is rebuilt, the tab that calls it will not be re-added to the index.

A tab sending a message to itself is not completely supported. Do not assume that it will not receive the message, but do not rely on it.