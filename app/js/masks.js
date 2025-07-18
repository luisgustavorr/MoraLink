$('#cron_shark').mask('r r r r r', {
    translation: {
      'r': {
        pattern: /[0-9]|\*/,
      }
    }
  })