//plugin for rotation animation
$.fn.animateRotate = function(endAngle, options, startAngle)
{
    return this.each(function()
    {
        var elem = $(this), rad, costheta, sintheta, matrixValues, noTransform = !('transform' in this.style || 'webkitTransform' in this.style || 'msTransform' in this.style || 'mozTransform' in this.style || 'oTransform' in this.style),
            anims = {}, animsEnd = {};
        if(typeof options !== 'object')
        {
            options = {};
        }
        else if(typeof options.extra === 'object')
        {
            anims = options.extra;
            animsEnd = options.extra;
        }
        anims.deg = startAngle;
        animsEnd.deg = endAngle;
        options.step = function(now, fx)
        {
            if(fx.prop === 'deg')
            {
                if(noTransform)
                {
                    rad = now * (Math.PI * 2 / 360);
                    costheta = Math.cos(rad);
                    sintheta = Math.sin(rad);
                    matrixValues = 'M11=' + costheta + ', M12=-'+ sintheta +', M21='+ sintheta +', M22='+ costheta;
                    // $('body').append('Test ' + matrixValues + '<br />');
                    elem.css({
                        'filter': 'progid:DXImageTransform.Microsoft.Matrix(sizingMethod=\'auto expand\','+matrixValues+')',
                        '-ms-filter': 'progid:DXImageTransform.Microsoft.Matrix(sizingMethod=\'auto expand\','+matrixValues+')'
                    });
                }
                else
                {
                    elem.css({
                        //webkitTransform: 'rotate('+now+'deg)',
                        //mozTransform: 'rotate('+now+'deg)',
                        //msTransform: 'rotate('+now+'deg)',
                        //oTransform: 'rotate('+now+'deg)',
                        transform: 'rotate('+now+'deg)'
                    });
                }
            }
        };
        if(startAngle)
        {
        	if(elem.data('anims')) {
        		elem.data('anims').stop();
        	}
        	var animsEl = $(anims);
            animsEl.animate(animsEnd, options);
        	elem.data('anims', animsEl);
        }
        else
        {
            elem.animate(animsEnd, options);
        }
    });
};