/** Build: npx tailwindcss@3 -i ./tailwind.css -o ./styles.css --minify
 *  Re-run this whenever you add/change Tailwind classes in index.html or the JS files. */
module.exports = {
  content: ['./index.html', './*.js', '!./tailwind.config.js'],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: '#FBC7DE',
          babypink: '#FDE2ED',
          blush: '#F6A8C9',
          lavender: '#E3D6F5',
          lavenderDeep: '#C6A8E8',
          blue: '#C9E4F6',
          blueDeep: '#9FCBEC',
          text: '#5B4B66',
          textSoft: '#8A7897'
        }
      },
      fontFamily: {
        sans: ['Quicksand', 'sans-serif']
      }
    }
  }
};
