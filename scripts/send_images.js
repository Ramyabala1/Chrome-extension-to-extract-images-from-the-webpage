(function () {
  /* globals chrome */
  'use strict';

  const extractImage = {   
    imageRegex: /(?:([^:\/?#]+):)?(?:\/\/([^\/?#]*))?([^?#]*\.(?:bmp|gif|jpe?g|png|svg|webp))(?:\?([^#]*))?(?:#(.*))?/i,

    extractImagesFromTags() {
      return [].slice.apply(document.querySelectorAll('img, a, [style]')).map(extractImage.extractImageFromElement);
    },

    extractImagesFromStyles() {
      const imagesFromStyles = [];
      for (let i = 0; i < document.styleSheets.length; i++) {
        const styleSheet = document.styleSheets[i];
        if (styleSheet.hasOwnProperty('cssRules')) {
          const { cssRules } = styleSheet;
          for (let j = 0; j < cssRules.length; j++) {
            const style = cssRules[j].style;
            if (style && style.backgroundImage) {
              const url = extractImage.extractURLFromStyle(style.backgroundImage);
              if (extractImage.isImageURL(url)) {
                imagesFromStyles.push(url);
              }
            }
          }
        }
      }

      return imagesFromStyles;
    },

    extractImageFromElement(element) {
      if (element.tagName.toLowerCase() === 'img') {
        let src = element.src;
        const hashIndex = src.indexOf('#');
        if (hashIndex >= 0) {
          src = src.substr(0, hashIndex);
        }
        return src;
      }

      if (element.tagName.toLowerCase() === 'a') {
        const href = element.href;
        if (extractImage.isImageURL(href)) {
          extractImage.linkedImages[href] = '0';
          return href;
        }
      }

      const backgroundImage = window.getComputedStyle(element).backgroundImage;
      if (backgroundImage) {
        const parsedURL = extractImage.extractURLFromStyle(backgroundImage);
        if (extractImage.isImageURL(parsedURL)) {
          return parsedURL;
        }
      }

      return '';
    },

    extractURLFromStyle(url) {
      return url.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
    },

    isImageURL(url) {
      return url.indexOf('data:image') === 0 || extractImage.imageRegex.test(url);
    },

    relativeUrlToAbsolute(url) {
      return url.indexOf('/') === 0 ? `${window.location.origin}${url}` : url;
    },

    removeDuplicateOrEmpty(images) {
      const hash = {};
      for (let i = 0; i < images.length; i++) {
        hash[images[i]] = 0;
      }

      const result = [];
      for (let key in hash) {
        if (key !== '') {
          result.push(key);
        }
      }

      return result;
    }
  };

  extractImage.linkedImages = {}; // TODO: Avoid mutating this object in `extractImageFromElement`
  extractImage.images = extractImage.removeDuplicateOrEmpty(
    [].concat(
      extractImage.extractImagesFromTags(),
      extractImage.extractImagesFromStyles()
    ).map(extractImage.relativeUrlToAbsolute)
  );

  chrome.runtime.sendMessage({
    linkedImages: extractImage.linkedImages,
    images: extractImage.images
  });

  extractImage.linkedImages = null;
  extractImage.images = null;
}());
