var id_token = '';
var userId = '';
var msg_ids = [];
var isLastMessageReceived = false;
var asyncUpdateRequestPending = false;

// This one is called automatically by Google OAuth2 once it verifies that the user is signed
function onSignIn(googleUser) {
    var profile = googleUser.getBasicProfile();
    var username = profile.getName();
    userId = profile.getId();
    id_token = googleUser.getAuthResponse().id_token;

    $.ajax({
        url: '/token',
        data: JSON.stringify(id_token),
        contentType: 'application/json;charset=UTF-8',
        type: 'POST',
    }).done(function( data ) {
        if (data.success) {
            $( '#btnLogin' ).toggleClass('hidden', true);
            $( '#btnLogout' ).toggleClass('hidden', false).text(username + ' | Logout');
            $( '#main-form' ).toggleClass('hidden', false);
            $( '#login-warning' ).toggleClass('hidden', true);
            $( '.msg' ).each(function() {
                if ($(this).children('.posterId').html() == userId) {
                    $(this).children('.controls').toggleClass('hidden', false)
                }
                else {
                    $(this).children('.reply').toggleClass('hidden', false)
                }
            });
            }
        }
    );
}

function logOut() {
    var auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function(){
        $( '#btnLogin' ).toggleClass('hidden', false);
        $( '#btnLogout' ).toggleClass('hidden', true);
        $( '#main-form' ).toggleClass('hidden', true);
        $( '#login-warning' ).toggleClass('hidden', false);
        $( '.controls' ).toggleClass('hidden', true);
    });
}

function appendBlankMessage( msg_id, target, prepend=false ) {
    if ($('#posts').find('div.msg').find('#' + msg_id).length != 0) { return;} // then this message already exists
    let post = $('#proto-message').clone(withDataAndEvents=true);
    post.attr('id', msg_id);
    if ( prepend ) {
        target.prepend(post);
    }
    else {
        target.append(post);
    }
    post.addClass('msg');

}

function editMessage( msg ) {
    let post = $('#posts').find('.msg#' + msg.id).first();
    post.children('.date').html(msg.pub_date);
    post.children('.text').html(msg.text);
    post.children('.author').html(msg.author_name);
    post.children('.posterId').html(msg.poster_id);
    if (msg.is_edited) {post.addClass('edited'); }
    if (msg.is_deleted) {
        post.addClass('deleted');
        post.children('.edit').remove();
        post.children('.delete').remove();
        }
    if (post.children('.posterId').html() == userId) {
        post.children('.controls').toggleClass('hidden', false)
    }
    // if it has no children Show and Hide controls are hidden
    if (msg.parent_id) {
        let parent = $('#posts').find('.msg#' + msg.parent_id).first();
        /*
        // if parent's SHOW button is hidden and parent has other children - means the button was clicked
        if (parent.find('.msg').length > 1 && parent.children('.toShow').hasClass('hidden'))
        {
            post.removeClass('hidden');
        }
        // enable show/hide controls for a parent with a single .msg child
        if (parent.find('.msg').length == 1) {
            parent.children('.toShow').toggleClass('hidden', false)
            parent.children('.toHide').toggleClass('hidden', true)
        }*/
        if (!parent.children('.toHide').hasClass('hidden')) {
            post.children('.toShow').toggleClass('hidden', false);
            post.children('.toHide').toggleClass('hidden', true);
            post.removeClass('hidden');
        }


    } else {
            if (post.hasClass('hidden')) {
            post.children('.toShow').toggleClass('hidden', false);
            post.children('.toHide').toggleClass('hidden', true);
            post.removeClass('hidden');
        }
    }

}

function appendMessage( msg, target, prepend=false ) {
    appendBlankMessage(msg.id, target, prepend);
    editMessage(msg);
}


$(document).ready(function (){
    $( '#btnLogout' ).on('click', function( event ){
        logOut();
    });

    $( '.main-load-all' ).on('click', function() {
        $.ajax({
            url: '/message/layout/'+ msg_ids.length +'/all/',
            contentType: 'application/json;charset=UTF-8',
            type: 'GET',
            success: function( data ) {
                msg_ids = msg_ids.concat(data.ids);
                for (var id of data.ids) {
                    appendBlankMessage(id, $('#posts'));
                    $.ajax({
                        url: '/message/' + id + '/',
                        contentType: 'application/json;charset=UTF-8',
                        type: 'GET',
                        success: function( data ) {
                            for(let msg of data.msgs) {
                                if ( msg.parent_id ) {
                                    appendMessage(msg, $('#' + msg.parent_id).children('.child'));
                                }
                                else {
                                    editMessage(msg);
                                }
                            }
                        },
                    });
                }
            },
        }).done(function() {
            $('#NoMoreMsgsWarning').removeClass('hidden');
            isLastMessageReceived = true;
            $('.main-load-all').remove();
        });
    })

    $( '.main-send' ).on('click', function() {
        var data = {
            token: id_token,
            text: $('#main-form textarea').val(),
            parent: null,
        };
        $.ajax({
            url: '/message/',
            data: JSON.stringify(data),
            contentType: 'application/json;charset=UTF-8',
            type: 'POST',
            success: function( data ) {
                $.ajax({
                    url: '/message/' + data.new_msg_id + '/',
                    contentType: 'application/json;charset=UTF-8',
                    type: 'GET',
                    success: function( data ) {
                        for(let msg of data.msgs) {
                            appendMessage(msg, $('#posts'), prepend=true);
                        }
                        $( '#main-form textarea' ).val('');
                    },
                });
            },
            error: function( data ) {
                alert(data.error)
            },
        });
    });

    // actions on click on buttons in reply forms
    $( '.reply-send' ).on('click', function() {
        var for_deleting = $(this).parent();
        let parent_id = $(this).closest('.msg').attr('id');
        var data = {
            token: id_token,
            text: $(this).siblings('textarea').val(),
            parent: parent_id,
        };
        $.ajax({
            url: '/message/' + parent_id + '/',
            data: JSON.stringify(data),
            contentType: 'application/json;charset=UTF-8',
            type: 'POST',
            success: function( data ) {
                $.ajax({
                    url: '/message/' + data.new_msg_id + '/',
                    contentType: 'application/json;charset=UTF-8',
                    type: 'GET',
                    success: function( data ) {
                        for(let msg of data.msgs) {
                            if ( msg.parent_id ) {
                                appendMessage(msg, $('#' + msg.parent_id).children('.child'));
                            }
                            else {
                                editMessage(msg);
                            }
                        }
                        for_deleting.remove();
                    },
                });
            },
            error: function( data ) {
                alert(data.error)
            },
        });
    });

    $( '.reply-edit' ).on('click', function() {
        var for_deleting = $(this).parent();
        var data = {
            token: id_token,
            text: $(this).siblings('textarea').val(),
        };
        $.ajax({
            url: '/message/' + $(this).closest('.msg').attr('id') + '/',
            data: JSON.stringify(data),
            contentType: 'application/json;charset=UTF-8',
            type: 'PUT',
            success: function( data ) {
                $.ajax({
                    url: '/message/' + data.new_msg_id + '/',
                    contentType: 'application/json;charset=UTF-8',
                    type: 'GET',
                    success: function( data ) {
                        for(let msg of data.msgs) {
                            editMessage(msg);
                        }
                        for_deleting.remove();
                    },
                });
            },
            error: function( data ) {
                alert(data.error)
            },
        });
    });

    $( '.reply-delete-confirm' ).on('click', function() {
        var for_deleting = $(this).parent();
        var data = {
            token: id_token
        };
        $.ajax({
            url: '/message/' + $(this).closest('.msg').attr('id') + '/',
            data: JSON.stringify(data),
            contentType: 'application/json;charset=UTF-8',
            type: 'DELETE',
            success: function( data ) {
                $.ajax({
                    url: '/message/' + data.new_msg_id + '/',
                    contentType: 'application/json;charset=UTF-8',
                    type: 'GET',
                    success: function( data ) {
                        for(let msg of data.msgs) {
                            editMessage(msg);
                            $(this).closest('.msg').removeClass('edited')
                        }
                        for_deleting.remove();
                    },
                });
            },
            error: function( data ) {
                alert(data.error)
            },
        });
    });

    // actions on click on the <a ...> 'buttons'
    $( '.reply' ).on('click', function( event ) {
        $(this).siblings().find('textarea').parent().remove();
        let box = $('#proto-form').clone(withDataAndEvents=true);
        box.removeAttr('id');
        $(this).siblings('.child').prepend(
            box
        );
        box.children('.reply-edit').remove();
        box.children('.reply-delete-confirm').remove();
        box.addClass('form');
        box.removeClass('hidden');
    });

    $( '.edit' ).on('click', function( event ) {
        $(this).siblings().find('textarea').parent().remove();
        let box = $('#proto-form').clone(withDataAndEvents=true);
        box.removeAttr('id');
        $(this).siblings('.child').prepend(
            box
        );
        box.children('textarea').val($(this).siblings('.text').text());
        box.children('.reply-send').remove();
        box.children('.reply-delete-confirm').remove();
        box.addClass('form');
        box.removeClass('hidden');
    });

    $( '.delete' ).on('click', function( event ) {
        $(this).siblings().find('textarea').parent().remove();
        let box = $('#proto-form').clone(withDataAndEvents=true);
        box.removeAttr('id');
        $(this).siblings('.child').prepend(
            box
        );
        box.children('.reply-send').remove();
        box.children('.reply-edit').remove();
        box.children('textarea').remove();
        box.addClass('form');
        box.removeClass('hidden');
    });

    $( '.reply-cancel' ).on('click', function( event ) {
        $(this).parent().remove();
    });

    $( '.main-show-all').on('click', function( event ){
        $('#posts').find('.msg').each( function() {
            $(this).children('.toShow').toggleClass('hidden', true);
            $(this).children('.toHide').toggleClass('hidden', false);
            $(this).toggleClass('hidden', false);
        });
    });

    $( '.toShow' ).on('click', function( event ) {
        $(this).toggleClass('hidden', true);
        $(this).siblings('.toHide').toggleClass('hidden', false);
        $(this).siblings('.child').find('.msg').each( function() {
            $(this).children('.toShow').toggleClass('hidden', true);
            $(this).children('.toHide').toggleClass('hidden', false);
            $(this).toggleClass('hidden', false);
        });
    });

    $( '.toHide' ).on('click', function( event ) {
        $(this).toggleClass('hidden', true);
        $(this).siblings('.toShow').toggleClass('hidden', false);
        $(this).siblings('.child').find('.msg').each( function() {
            $(this).children('.toShow').toggleClass('hidden', false);
            $(this).children('.toHide').toggleClass('hidden', true);
            $(this).toggleClass('hidden', true);
        });
    });

    // pulling initial messages
    var initMessagesLimit = 10;

    asyncUpdateRequestPending = true;
    $.ajax({
        url: '/message/layout/0/' + initMessagesLimit + '/',
        contentType: 'application/json;charset=UTF-8',
        type: 'GET',
        success: function( data ) {
            msg_ids = data.ids;
            for (var id of msg_ids) {
                appendBlankMessage(id, $('#posts'))
            }
            for (i=0; i < initMessagesLimit; i++) {
                $.ajax({
                    url: '/message/' + msg_ids[i] + '/',
                    contentType: 'application/json;charset=UTF-8',
                    type: 'GET',
                    success: function( data ) {
                        for(let msg of data.msgs) {
                            if ( msg.parent_id ) {
                                appendMessage(msg, $('#' + msg.parent_id).children('.child'));
                            }
                            else {
                                editMessage(msg);
                            }
                        }
                    },
                });
            }
            if (data.ids.length == 0) {
                $('#NoMoreMsgsWarning').removeClass('hidden');
                isLastMessageReceived = true;
            }
        },
        error: function ( data ) {alert('Something went wrong! Reloading the page...'); location.reload(); }
    }).done(function() {asyncUpdateRequestPending=false; });
    $(window).scroll(function () {
        if (isLastMessageReceived) {return;}
        var height = $('#posts').height();
        var scroll = $(this).scrollTop() + $(window).height();

        // This is an approximate value, but it seems to suffice - the margin is about 400 px - as much as we need
        var isScrolledToEnd = (scroll >= height);

        if (isScrolledToEnd && !asyncUpdateRequestPending) {
            asyncUpdateRequestPending = true;
            $.ajax({
                url: '/message/layout/'+ msg_ids.length +'/' + (msg_ids.length + 8) + '/',
                contentType: 'application/json;charset=UTF-8',
                type: 'GET',
                success: function( data ) {
                    msg_ids = msg_ids.concat(data.ids);
                    for (var id of data.ids) {
                        appendBlankMessage(id, $('#posts'));
                        $.ajax({
                            url: '/message/' + id + '/',
                            contentType: 'application/json;charset=UTF-8',
                            type: 'GET',
                            success: function( data ) {
                                for(let msg of data.msgs) {
                                    if ( msg.parent_id ) {
                                        appendMessage(msg, $('#' + msg.parent_id).children('.child'));
                                    }
                                    else {
                                        editMessage(msg);
                                    }
                                }
                            },
                        });
                    }
                    if (data.ids.length == 0) {
                        $('#NoMoreMsgsWarning').removeClass('hidden');
                        isLastMessageReceived = true;
                    }
                },
            }).done( function () {window.setTimeout(allowEvent, 1200); } );
        }
    });
});

function allowEvent() {asyncUpdateRequestPending = false;}
