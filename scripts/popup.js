(function (ls) {
  /* globals $, jss, chrome */
  /* jshint multistr: true */
  'use strict';

  function initializePopup() {
    $('#images_table')
      .on('change', '#toggle_all_checkbox', function () {
        $('#download_button').prop('disabled', !this.checked);
        for (var i = 0; i < visibleImages.length; i++) {
          $('#image' + i).toggleClass('checked', this.checked);
        }
      })
    // Get images on the page
    chrome.windows.getCurrent(function (currentWindow) {
      chrome.tabs.query({ active: true, windowId: currentWindow.id }, function (activeTabs) {
        chrome.tabs.executeScript(activeTabs[0].id, { file: '/scripts/send_images.js', allFrames: true });
      });
    });
  }

  function suggestNewFilename(item, suggest) {
    var newFilename = '';
    if (ls.folder_name) {
      newFilename = ls.folder_name + '/';
    }
    if (ls.new_file_name) {
      var regex = /(?:\.([^.]+))?$/;
      var extension = regex.exec(item.filename)[1];
      if (parseInt(ls.image_count, 10) === 1) {
        newFilename += ls.new_file_name + '.' + extension;
      }
      else {
        newFilename += ls.new_file_name + ls.image_number + '.' + extension;
        ls.image_number++;
      }
    }
    else {
      newFilename += item.filename;
    }
    suggest({ filename: newFilename });
  }

  function initializeStyles() {
    // General
    $('#file_renaming_textbox').toggle(ls.show_file_renaming === 'true');

    // Filters
    $('#image_url_filter').toggle(ls.show_url_filter === 'true');
    $('#image_width_filter').toggle(ls.show_image_width_filter === 'true');
    $('#image_height_filter').toggle(ls.show_image_height_filter === 'true');
    $('#only_images_from_links_container').toggle(ls.show_only_images_from_links === 'true');

    // Images
    jss.set('.image_buttons_container', {
      'margin-top': (ls.show_image_url === 'true' ? 3 : -3) + 'px'
    });

    jss.set('img', {
      'min-width': ls.image_min_width + 'px',
      'max-width': ls.image_max_width + 'px',
      'border-width': ls.image_border_width + 'px',
      'border-style': 'solid',
      'border-color': '#f6f6f6'
    });
    jss.set('img.checked', {
      'border-color': ls.image_border_color
    });

    // Periodically set the body padding to offset the height of the fixed position filters
    setInterval(function () {
      $('body').css('padding-top', $('#filters_container').height());
    }, 200);
  }

  var allImages = [];
  var visibleImages = [];
  var linkedImages = {};

  // Add images to `allImages` and trigger filtration
  // `send_images.js` is injected into all frames of the active tab, so this listener may be called multiple times
  chrome.runtime.onMessage.addListener(function (result) {
    $.extend(linkedImages, result.linkedImages);
    for (var i = 0; i < result.images.length; i++) {
      if (allImages.indexOf(result.images[i]) === -1) {
        allImages.push(result.images[i]);
      }
    }
    filterImages();
  });

  var timeoutID;
  function filterImages() {
    clearTimeout(timeoutID); // Cancel pending filtration
    timeoutID = setTimeout(function () {
      var images_cache = $('#images_cache');
      if (ls.show_image_width_filter === 'true' || ls.show_image_height_filter === 'true') {
        var cached_images = images_cache.children().length;
        if (cached_images < allImages.length) {
          for (var i = cached_images; i < allImages.length; i++) {
            // Refilter the images after they're loaded in cache
            images_cache.append($('<img src="' + encodeURI(allImages[i]) + '" />').on('load', filterImages));
          }
        }
      }

      // Copy all images initially
      visibleImages = allImages.slice(0);

      if (ls.show_url_filter === 'true') {
        var filterValue = $('#filter_textbox').val();
        if (filterValue) {
          switch (ls.filter_url_mode) {
            case 'normal':
              var terms = filterValue.split(' ');
              visibleImages = visibleImages.filter(function (url) {
                for (var i = 0; i < terms.length; i++) {
                  var term = terms[i];
                  if (term.length !== 0) {
                    var expected = (term[0] !== '-');
                    if (!expected) {
                      term = term.substr(1);
                      if (term.length === 0) {
                        continue;
                      }
                    }
                    var found = (url.indexOf(term) !== -1);
                    if (found !== expected) {
                      return false;
                    }
                  }
                }
                return true;
              });
              break;
            case 'wildcard':
              filterValue = filterValue.replace(/([.^$[\]\\(){}|-])/g, '\\$1').replace(/([?*+])/, '.$1');
              /* fall through */
            case 'regex':
              visibleImages = visibleImages.filter(function (url) {
                try {
                  return url.match(filterValue);
                }
                catch (e) {
                  return false;
                }
              });
              break;
          }
        }
      }

      if (ls.show_only_images_from_links === 'true' && ls.only_images_from_links === 'true') {
        visibleImages = visibleImages.filter(function (url) {
          return linkedImages[url];
        });
      }

     

      displayImages();
    }, 200);
  }

  function displayImages() {
    $('#download_button').prop('disabled', true);

    var images_table = $('#images_table').empty();

    var toggle_all_checkbox_row = '<tr><th align="left" colspan="' + ls.columns + '"><label><input type="checkbox" id="toggle_all_checkbox" />Select all (' + visibleImages.length + ')</label></th></tr>';
    images_table.append(toggle_all_checkbox_row);

    var columns = parseInt(ls.columns);
    var columnWidth = (Math.round(100 * 100 / columns) / 100) + '%';
    var rows = Math.ceil(visibleImages.length / columns);

    // Tools row
    var show_image_url = ls.show_image_url === 'true';
    var show_open_image_button = ls.show_open_image_button === 'true';
    var show_download_image_button = ls.show_download_image_button === 'true';

    // Append dummy image row to keep the popup width constant
    var dummy_row = $('<tr></tr>');
    var colspan = ((show_image_url ? 1 : 0) + (show_open_image_button ? 1 : 0) + (show_download_image_button ? 1 : 0)) || 1;
    for (var columnIndex = 0; columnIndex < columns; columnIndex++) {
      var dummy_cell = '<td colspan="' + colspan + '" style="min-width: ' + ls.image_max_width + 'px; width: ' + columnWidth + '; vertical-align: top;"></td>';
      dummy_row.append(dummy_cell);
    }
    //images_table.append(dummy_row);

    for (var rowIndex = 0; rowIndex < rows; rowIndex++) {
      if (show_image_url || show_open_image_button || show_download_image_button) {
        var tools_row = $('<tr></tr>');
        for (var columnIndex = 0; columnIndex < columns; columnIndex++) {
          var index = rowIndex * columns + columnIndex;
          if (index === visibleImages.length) break;

          if (show_image_url) {
            tools_row.append('<td><input type="text" class="image_url_textbox" value="' + visibleImages[index] + '" readonly /></td>');
          }

          if (show_open_image_button) {
            tools_row.append('<td class="open_image_button" data-url="' + visibleImages[index] + '" title="Open in new tab">&nbsp;</td>');
          }

          if (show_download_image_button) {
            tools_row.append('<td class="download_image_button" data-url="' + visibleImages[index] + '" title="Download">&nbsp;</td>');
          }
        }
        //images_table.append(tools_row);
      }

      // Images row
      var images_row = $('<tr></tr>');
      for (var columnIndex = 0; columnIndex < columns; columnIndex++) {
        var index = rowIndex * columns + columnIndex;
        if (index === visibleImages.length) break;
        var image = '<td colspan="' + colspan + '" style="min-width: ' + ls.image_max_width + 'px; width: ' + columnWidth + '; vertical-align: top;"><img id="image' + index + '" src="' + visibleImages[index] + '" /></td>';
        images_row.append(image);
      }
      images_table.append(images_row);
    }
  }

  $(function () {
    initializePopup();
    initializeStyles();
  });
}(localStorage));
