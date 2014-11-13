
var UI_NEXT = 1,
    UI_PREV = -1;


/**
  Setup and manage the UI of the page
*/
(function() {
  var historyIndex = -1;

  window.UI = {
    currentGif: null,
    unloading: false,

    /**
      Run the page program
    */
    init: function() {

      SassController.importAll();

      // Load from storage, then build page
      Store2.init().then((function(){
        Store2.getGifs().then((function(gifs){
          Store.load(null).then((function(){
            var id;

            this.updateSettings();
            this.setTheme(Store.settings.theme);

            // Attempt to find an ID in the URL
            if (document.location.hash.length > 1) {
              id = document.location.hash.substr(5); // #gif=123
            }
            // In the hidden form field
            else if ($("#gifid").val() != '') {
              id = $("#gifid").val();
            }

            // No gifs
            if (gifs.length == 0) {
              Gifs.loadNewGifs().then(this.showRandomGif.bind(this));
            }

            // Attempt to load existing gif (from location hash)
            else if (id) {
              Store2.getByID(id)
              .then((function(gif){
                this.showGif(gif);
                this.buildHistory();
                Gifs.loadNewGifs();
              }).bind(this))
              .fail((function(){
                this.showRandomGif();
              }).bind(this));
            }

            // Show random gif
            else {
              this.showRandomGif();
              Gifs.loadNewGifs();
            }

            Gifs.loadNewGifs();
            this.buildFavorites();
          }).bind(this));
        }).bind(this));
      }).bind(this));
    },

    /**
      Setup the settings panel
    */
    updateSettings: function() {
      $('#theme-select').val(Store.settings.theme);
      $('#setting-giphy').attr('checked', Store.settings.giphy);
      $('#setting-reddit').attr('checked', Store.settings.reddit);
    },

    /**
      Set the theme of the page

      @param {String} name The file name to the stylesheet file for the theme
    */
    setTheme: function(name) {
      var chooser = $('#theme-select');

      //stylesheet.attr('href', '/themes/'+ name +'.css');
      chooser.val(name);
      SassController.importFile('./themes/'+ name +'.scss', 'theme-css');

      Store.settings.theme = name;
      Store.save('settings');
    },

    /**
      Select a gif at random and display it
    */
    showRandomGif: function() {
      Gifs.random().then((function(gif){
        Store2.addToHistory(gif);
        this.showGif(gif);
      }).bind(this));
    },

    /**
      Display a gif

      @param {Object} gif The gif to show
    */
    showGif: function(gif) {
      var container = $('section.main'),
          aEl = container.find('a.image'),
          imgEl = container.find('a.image img');

      if (!gif) {
        return;
      }

      this.currentGif = gif;

      // Clear image
      imgEl.attr('src', 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==');

      // Attributes
      aEl.attr({
        id: gif.id,
        href: gif.url
      });
      imgEl.attr('src', gif.url);

      // Title
      if (gif.title && gif.title != '') {
        container.addClass('has-title');
        container.find('figcaption span').text(gif.title);
        document.title = "New Tab ("+ gif.title +")";
      } else {
        container.removeClass('has-title');
        container.find('figcaption span').text('');
        document.title = "New Tab";
      }

      // Source list
      container.find('cite span').empty();
      if (gif.sources) {
        gif.sources.forEach(function(source) {
          var urlParts = source.match(/https?:\/\/(.*?)([\/|\?].*)?$/),
              link = $("<a>"),
              siteName, isFav;

          // grab the second to last domain part
          // i.e. www.reddit.com -> reddit
          siteName = urlParts[1].split('.').slice(-2)[0];

          // Build source link
          link.attr('href', source);
          link.text(siteName);

          container.find('cite span').append(link);
        });

        container.find('cite').addClass('has-source');
      } else {
        container.find('cite').removeClass('has-source');
      }

      // Is it a favorite
      this.isFavorite();

      // Finish up
      container.removeClass('loading');
      $("#gifid").val(gif.id);
      if (!this.unloading) {
        document.location.replace("#gif="+ gif.id);
      }

      setTimeout(this.setWindowSizing, 50);
    },

    /**
      Build a list of gifs

      @param {Array} gifs The array of images or image IDs to build from
      @param {HTMLNode} section The HTML section that has the list
    */
    buildList: function(gifs, section) {
      var container = section,
          list = container.find('ul'),
          elements = list.find('li'),
          i = 0, selected = 0;

      // Remove extra items
      if (gifs.length < elements.length) {
        elements.slice(gifs.length).remove();
      }

      // Build list
      gifs.every((function(gif, index){
        var item, img,
            preload = new Image();

        if (!gif) {
          return true;
        }

        // Reuse list item
        if (item = elements.get(i)) {
          item = $(item);
          img = item.find('img');

        } else {
          item = $('<li>');
          img  = $('<img>');
          item.append(img);
          list.append(item);
        }

        // New image
        if (img.attr('id') != gif.id) {
          img.removeClass('loaded');
          img.addClass('loading');

          // Set loaded class when image loads
          img.get(0).onload = function(){
            img.removeClass('loading');
            img.addClass('loaded');
          };

          // Set the SRC after a slight delay
          // (in case CSS is fading the old image out)
          setTimeout(function(){
            img.attr('src', gif.thumb);

            // Call onload if image is cached
            if (img.get(0).complete) {
              img.get(0).onload.call(img.get(0));
            }
          }, 100);


          // Other attributes
          img.attr('data-id', gif.id);
          img.attr('alt', gif.title);
          img.attr('title', gif.title);
          img.attr('data-index', i);

          // Preload full image version
          preload.src = gif.url;
        }

        // Is it the current gif being display
        if (this.currentGif && gif.id == this.currentGif.id) {
          selected = i;
          item.addClass('selected');
        } else {
          item.removeClass('selected');
        }

        i++;
        return true;
      }).bind(this));

      container.toggleClass('empty', i == 0);

      // Add number class
      container.removeClass (function (index, css) {
        return (css.match (/(^|\s)num-\d+/g) || []).join(' ');
      });
      container.addClass('num-'+ i);

      // Add selected class
      container.removeClass (function (index, css) {
        return (css.match (/(^|\s)selected-\d+/g) || []).join(' ');
      });
      container.addClass('selected-'+ selected);

      this.setWindowSizing();
    },

    /**
      Checks if the current gif is marked as a favorite,
      then updates the UI to reflect this and returns true/false,
      depending on the favorite status

      @return True if the gif is marked as favorite
    */
    isFavorite: function(){
      return Gifs.isFavorite(this.currentGif.id).then(function(isFav){
        $('section.main').toggleClass('favorite', isFav);
      });
    },

    /**
      Update the history selection and arrows
    */
    updateHistorySelection: function(){
      var body = $(document.body),
          selected = $('section.history ul li.selected'),
          all = $('section.history ul li'),
          targetId = (this.currentGif) ? this.currentGif.id : null,
          targetEl = (targetId) ? $('section.history ul li img[data-id='+ targetId +']') : [];

      selected.removeClass('selected');
      if (targetEl.length) {
        targetEl.parent('li').addClass('selected');
      }

      // Set location classes
      body.toggleClass('history-first', (targetEl.length && targetEl.data('index') == 0));
      body.toggleClass('history-last', (targetEl.length && targetEl.data('index') == all.length - 1));
    },

    /**
      Build favorites list
    */
    buildFavorites: function(){
      Store2.getFavorites().then((function(favorites){
        this.buildList(favorites, $('section.favorites'));
      }).bind(this));
    },

    /**
      Build the history list
    */
    buildHistory: function() {
      Store2.getHistory().then((function(history){
        this.buildList(history, $('section.history'));
        this.updateHistorySelection();
      }).bind(this));
    },

    /**
      Change the history element we're viewing, either next or previous

      @param {int} dir The direction to move (UI_NEXT, UI_PREV)
    */
    historyIncrement: function(dir) {
      var list = $('section.history ul'),
          selected = list.find('li.selected').first(),
          target;

      // Validate input
      if (dir != UI_NEXT && dir != UI_PREV) {
        return false;
      }

      // Previous image in the history
      if (dir == UI_NEXT && selected.length) {
        target = selected.prev('li');
      }
      // Next image
      else if (dir == UI_PREV) {
        if (selected.length) {
          target = selected.next('li');

          // At the first item in history, cancel increment
          if (!target.length) {
            return;
          }
        } else {
          list.find('li:first-child');
        }
      }


      // New selection
      if (target && target.length) {
        Store2.getByID(target.find('img').attr('data-id')).then((function(gif){
          this.showGif(gif);
          this.updateHistorySelection();
        }).bind(this));
      }
      // No history item found, show new image
      else {
        this.showRandomGif();
      }
    },

    /**
      If there's room  for all content in the viewport add body
      class "fits-view"
    */
    setWindowSizing: function() {
      var viewport = $(window).height(),
          body = $(document.body);

      body.removeClass('fits-view');

      // The document fits in the viewport
      if (viewport >= $(document).height()) {
        body.addClass('fits-view');
      }
    }

  }

  // State Listeners
  Messenger.addListener('history-updated', function(){
    UI.buildHistory();
  });
  Messenger.addListener('favorites-updated', function(){
    UI.isFavorite();
    UI.buildFavorites();
  });
})();

UI.init();