// src/components/WebMapView.js
//
// Web-only replacement for `import { WebView } from 'react-native-webview'`.
// react-native-webview does NOT support the web platform at all, which is
// why you saw the "does not support this platform" error.
//
// Since this project only needs to run as a website, we render the map's
// raw HTML (source.html) inside a normal browser <iframe> instead.
//
// It supports the same props/usage your screens already have:
//   <WebView source={{ html: mapHtml }} style={...} onLoadEnd={...} />
//   ref.current.injectJavaScript(js) 

import React, { forwardRef, useImperativeHandle, useRef } from 'react';

const WebMapView = forwardRef((props, ref) => {
  const { source, style, onLoadEnd } = props;
  const iframeRef = useRef(null);

  useImperativeHandle(ref, () => ({
    injectJavaScript: (js) => {
      try {
        const win = iframeRef.current && iframeRef.current.contentWindow;
        if (win) {
          // srcDoc iframes (no sandbox attribute) share the parent's JS
          // context, so eval-ing inside them works like injectJavaScript did.
          win.eval(js);
        }
      } catch (e) {
        console.warn('WebMapView injectJavaScript failed: - WebMapView.js:30', e);
      }
    },
  }));

  return (
    <iframe
      ref={iframeRef}
      srcDoc={source && source.html}
      style={{
        border: 'none',
        width: '100%',
        height: '100%',
        ...(style || {}),
      }}
      onLoad={onLoadEnd}
      title="live-map"
    />
  );
});

export default WebMapView;