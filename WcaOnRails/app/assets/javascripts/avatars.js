onPage('avatars#index', function() {
  $('.actions').on('change', function() {
    var $rejectButton = $('input[value="reject"]');
    $rejectButton.closest('.row').find('.rejection-reason').toggle($rejectButton.prop('checked'));
  }).trigger('change');
});
