/**
 * ARTIPLAY — front-end behaviour.
 *
 * Everything on this site works without JavaScript. This file adds three
 * enhancements and nothing else:
 *
 *   1. the mobile navigation disclosure;
 *   2. auto-submit on the project filter;
 *   3. analytics events for the actions that indicate commercial intent.
 *
 * No framework, no jQuery, no polyfills. It is deferred, so it never blocks
 * rendering, and it is small enough that parsing it costs nothing measurable.
 */
( function () {
	'use strict';

	var doc = document;
	var win = window;

	/* ---------------------------------------------------------------------
	 * Navigation
	 *
	 * The button is a real <button> with aria-expanded in the markup, so it is
	 * already announced and operable before this runs. All that happens here
	 * is flipping the attribute, swapping the accessible label, and handling
	 * Escape and outside clicks.
	 * ------------------------------------------------------------------ */

	function initNavigation() {
		var toggle = doc.querySelector( '[data-apl-nav-toggle]' );
		var nav = doc.getElementById( 'apl-nav' );

		if ( ! toggle || ! nav ) {
			return;
		}

		var label = toggle.querySelector( '[data-apl-nav-label]' );
		var labels = {
			open: toggle.getAttribute( 'data-label-open' ) || 'Fermer le menu',
			closed: label ? label.textContent : 'Ouvrir le menu'
		};

		function setState( open ) {
			toggle.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
			nav.classList.toggle( 'is-open', open );

			if ( label ) {
				label.textContent = open ? labels.open : labels.closed;
			}
		}

		toggle.addEventListener( 'click', function () {
			setState( toggle.getAttribute( 'aria-expanded' ) !== 'true' );
		} );

		// Escape closes the menu and returns focus to the control that opened
		// it — otherwise focus is left orphaned in a hidden container.
		doc.addEventListener( 'keydown', function ( event ) {
			if ( event.key !== 'Escape' ) {
				return;
			}
			if ( toggle.getAttribute( 'aria-expanded' ) === 'true' ) {
				setState( false );
				toggle.focus();
			}
		} );

		doc.addEventListener( 'click', function ( event ) {
			if ( toggle.getAttribute( 'aria-expanded' ) !== 'true' ) {
				return;
			}
			if ( nav.contains( event.target ) || toggle.contains( event.target ) ) {
				return;
			}
			setState( false );
		} );

		// Reset when the viewport crosses into the desktop layout, so the
		// panel state does not persist into a bar that is always visible.
		var desktop = window.matchMedia( '(min-width: 60rem)' );
		var onChange = function ( event ) {
			if ( event.matches ) {
				setState( false );
			}
		};

		if ( typeof desktop.addEventListener === 'function' ) {
			desktop.addEventListener( 'change', onChange );
		}
	}

	/* ---------------------------------------------------------------------
	 * Project filter
	 *
	 * The form submits normally without JavaScript. With it, changing a select
	 * submits immediately and the now-redundant button is removed from the
	 * layout and the tab order.
	 * ------------------------------------------------------------------ */

	function initFilters() {
		var selects = doc.querySelectorAll( '[data-apl-filter]' );
		if ( ! selects.length ) {
			return;
		}

		Array.prototype.forEach.call( selects, function ( select ) {
			select.addEventListener( 'change', function () {
				if ( select.form ) {
					select.form.submit();
				}
			} );
		} );

		var submit = doc.querySelector( '[data-apl-filter-submit]' );
		if ( submit ) {
			submit.hidden = true;
		}
	}

	/* ---------------------------------------------------------------------
	 * Analytics
	 *
	 * One delegated listener covering every intent signal, pushing to
	 * dataLayer when a tag manager is present. Each event fires once per
	 * click; there is no second listener anywhere that could double-count.
	 * ------------------------------------------------------------------ */

	function initAnalytics() {
		doc.addEventListener( 'click', function ( event ) {
			var target = event.target;
			if ( ! ( target instanceof Element ) ) {
				return;
			}

			var trigger = target.closest( '[data-apl-event]' );
			if ( ! trigger ) {
				return;
			}

			var name = trigger.getAttribute( 'data-apl-event' );
			if ( ! name ) {
				return;
			}

			window.dataLayer = window.dataLayer || [];
			window.dataLayer.push( {
				event: name,
				link_url: trigger.getAttribute( 'href' ) || '',
				page_path: window.location.pathname
			} );
		} );

		// Successful quotation submissions are reported from the redirect
		// status the server sets, so the event reflects a stored lead rather
		// than a button press that may have failed validation.
		var params = new URLSearchParams( window.location.search );
		if ( params.get( 'devis' ) === 'ok' ) {
			window.dataLayer = window.dataLayer || [];
			window.dataLayer.push( {
				event: 'quote_submit',
				page_path: window.location.pathname
			} );
		}
	}

	/* ---------------------------------------------------------------------
	 * Form status focus
	 *
	 * After the redirect, move focus to the status message so a keyboard or
	 * screen-reader user learns the outcome instead of landing back at the top
	 * of the document with no indication anything happened.
	 * ------------------------------------------------------------------ */

	function initFormStatus() {
		var notice = doc.querySelector( '[data-apl-form-status]' );
		if ( ! notice ) {
			return;
		}

		notice.setAttribute( 'tabindex', '-1' );

		/*
		 * Focus AFTER the browser has finished with the URL fragment.
		 *
		 * The form redirects to `/contact/?devis=ok#devis`. Focusing the
		 * notice synchronously here appears to work — and is then silently
		 * undone, because the browser processes the `#devis` fragment
		 * afterwards and resets focus to the document body when the fragment
		 * target is not itself focusable.
		 *
		 * The visible symptom is nothing at all: the message is on screen, so
		 * it looks correct to anyone testing with their eyes. Only a keyboard
		 * or screen-reader user notices, because they are returned to the top
		 * of the document with no indication that anything happened. Found by
		 * driving a real browser through the conversion path, not by reading
		 * the code.
		 *
		 * Two nested rAF calls put this after the browser's own scroll-and-
		 * focus work in the same frame sequence, which is more reliable than a
		 * timeout guess.
		 */
		if ( typeof win.requestAnimationFrame === 'function' ) {
			win.requestAnimationFrame( function () {
				win.requestAnimationFrame( function () {
					notice.focus( { preventScroll: true } );
				} );
			} );
		} else {
			notice.focus( { preventScroll: true } );
		}
	}

	/* ---------------------------------------------------------------------
	 * Scroll reveal
	 *
	 * The reveal class is added BY THIS SCRIPT, never in the markup. That
	 * ordering is the whole safety of the feature: without JavaScript, or if
	 * this file fails to load, the elements were never hidden in the first
	 * place. A reveal implemented the other way round — hidden in CSS,
	 * un-hidden by JS — turns a script error into a blank page.
	 *
	 * IntersectionObserver rather than a scroll listener: no work on the main
	 * thread between intersections, which is what keeps this off the INP
	 * budget. Each element is unobserved once revealed.
	 * ------------------------------------------------------------------ */

	function initReveal() {
		if ( ! ( 'IntersectionObserver' in win ) ) {
			return;
		}

		if ( win.matchMedia && win.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) {
			return;
		}

		var targets = doc.querySelectorAll( '[data-apl-reveal]' );
		if ( ! targets.length ) {
			return;
		}

		var observer = new IntersectionObserver(
			function ( entries ) {
				entries.forEach( function ( entry ) {
					if ( ! entry.isIntersecting ) {
						return;
					}
					entry.target.classList.add( 'is-revealed' );
					observer.unobserve( entry.target );
				} );
			},
			{ rootMargin: '0px 0px -8% 0px', threshold: 0.06 }
		);

		var pending = [];

		Array.prototype.forEach.call( targets, function ( el ) {
			/*
			 * Anything already on screen at load is revealed immediately and
			 * never animated. Animating the content someone is already looking
			 * at delays their first read for no benefit — and on the home page
			 * that content contains the LCP element.
			 */
			var box = el.getBoundingClientRect();
			if ( box.top < win.innerHeight * 0.92 ) {
				el.classList.add( 'apl-reveal', 'is-revealed' );
				return;
			}

			el.classList.add( 'apl-reveal' );
			pending.push( el );
			observer.observe( el );
		} );

		/*
		 * FAILSAFE — non-negotiable.
		 *
		 * An IntersectionObserver only fires when something intersects. If the
		 * document never scrolls, the observer never fires and every element
		 * below the fold stays at opacity 0 — permanently. This is not
		 * hypothetical: it was observed on this build, with four of the home
		 * page's five sections invisible, because the surrounding context did
		 * not scroll the document the way the code assumed.
		 *
		 * Embedded contexts, some in-app browsers, reader modes, printing, and
		 * automated capture can all produce that state. The animation is a
		 * nicety; the content is the product. So after a short delay anything
		 * still hidden is shown regardless of whether it was ever scrolled to.
		 *
		 * Deliberately longer than a normal first scroll (so it does not steal
		 * the animation from a real visitor) and far shorter than anyone would
		 * spend deciding the page is broken.
		 */
		win.setTimeout( function () {
			pending.forEach( function ( el ) {
				if ( ! el.classList.contains( 'is-revealed' ) ) {
					el.classList.add( 'is-revealed' );
					observer.unobserve( el );
				}
			} );
		}, 1600 );
	}

	/* ---------------------------------------------------------------------
	 * Mobile call to action
	 *
	 * Appears once the hero has been scrolled past, so it never covers the
	 * hero's own buttons. Hidden again near the footer, where the real
	 * quotation section is.
	 * ------------------------------------------------------------------ */

	function initMobileCta() {
		var bar = doc.querySelector( '[data-apl-mobile-cta]' );
		if ( ! bar || ! ( 'IntersectionObserver' in win ) ) {
			return;
		}

		/*
		 * What is watched: the page's opening block. Every template has one —
		 * .apl-hero on the home page, and a <header> at the top of the article on
		 * every solution, project, archive and guide page — so this works without
		 * naming each template, and it is the region whose own call to action the
		 * bar exists to replace.
		 *
		 * The previous fallback was 'main'. Only the home page has .apl-hero, so
		 * every solution and project page fell through to main — which is taller
		 * than the viewport, therefore permanently intersecting, so the bar never
		 * appeared on any page that sells anything. It read as correct in the
		 * source and was invisible in every screenshot, because a bar that never
		 * slides in leaves no trace.
		 */
		var hero = doc.querySelector( '.apl-hero, main header' );

		if ( ! hero ) {
			var heading = doc.querySelector( 'main h1' );
			hero = heading ? heading.parentElement : null;
		}

		if ( ! hero ) {
			return;
		}

		var observer = new IntersectionObserver(
			function ( entries ) {
				entries.forEach( function ( entry ) {
					/*
					 * "Not intersecting" alone is not enough: a target that has not
					 * been reached yet is just as much not-intersecting as one that
					 * has been scrolled past, so the bar covered the page from the
					 * first pixel on any template whose CTA starts below the fold.
					 *
					 * boundingClientRect.top tells the two apart: positive means the
					 * target is still below, negative means it has gone off the top.
					 */
					bar.classList.toggle(
						'is-visible',
						! entry.isIntersecting && entry.boundingClientRect.top < 0
					);
				} );
			}
		);

		observer.observe( hero );
	}

	function init() {
		initNavigation();
		initFilters();
		initAnalytics();
		initFormStatus();
		initReveal();
		initMobileCta();
	}

	if ( doc.readyState === 'loading' ) {
		doc.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
}() );
