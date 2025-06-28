document.addEventListener('DOMContentLoaded', () => {
    // Tabs indicators
    const tabIndicators = document.querySelectorAll('.tab-indicator');
    // Action buttons
    const actionButtons = document.querySelectorAll('[data-action]');
    // Sections
    const sections = document.querySelectorAll('.section');
    // Circles
    const circles = document.querySelectorAll('.circle');
    // Scroll indicator
    const scrollIndicator = document.querySelector('.scroll-indicator');
    
    // Track current section index
    let currentSectionIndex = 0;
    const sectionIds = ['home', 'page1', 'page2', 'page3'];
    
    // Prevent default scrolling
    let isScrolling = false;
    let scrollTimeout = null;
    
    // Track if user has scrolled
    let hasScrolled = false;

    // Handle navigation
    function navigateTo(sectionId) {
        // Hide all sections
        sections.forEach(section => {
            section.classList.remove('active');
        });

        // Update active tab indicator
        tabIndicators.forEach(indicator => {
            if (indicator.dataset.section === sectionId) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });

        // Show the target section
        const targetSection = document.getElementById(sectionId);
        targetSection.classList.add('active');
        
        // Update current section index
        currentSectionIndex = sectionIds.indexOf(sectionId);

        // Animate circles based on section
        animateCirclesForSection(sectionId);
        
        // Hide scroll indicator after first navigation
        if (!hasScrolled && currentSectionIndex > 0) {
            hasScrolled = true;
            hideScrollIndicator();
        }
    }
    
    // Hide scroll indicator with animation
    function hideScrollIndicator() {
        if (scrollIndicator) {
            scrollIndicator.style.opacity = '0';
            scrollIndicator.style.transform = 'translate(-50%, 20px)';
            setTimeout(() => {
                scrollIndicator.style.display = 'none';
            }, 500);
        }
    }

    // Handle circle animations for different sections
    function animateCirclesForSection(sectionId) {
        // Reset any previous transforms
        circles.forEach(circle => {
            circle.style.transform = '';
        });

        // Apply different animations based on active section
        switch(sectionId) {
            case 'home':
                circles[0].style.transform = 'translate(-5%, -5%)';
                circles[1].style.transform = 'translate(5%, 5%)';
                circles[2].style.transform = 'translate(0, 0) scale(1)';
                break;
            case 'page1':
                circles[0].style.transform = 'translate(-15%, 5%) scale(0.9)';
                circles[1].style.transform = 'translate(10%, -10%) scale(1.1)';
                circles[2].style.transform = 'translate(5%, 15%) scale(1.2)';
                break;
            case 'page2':
                circles[0].style.transform = 'translate(10%, 10%) scale(1.1)';
                circles[1].style.transform = 'translate(-5%, -15%) scale(0.8)';
                circles[2].style.transform = 'translate(20%, 0) scale(1.3)';
                break;
            case 'page3':
                circles[0].style.transform = 'translate(15%, -5%) scale(1.2)';
                circles[1].style.transform = 'translate(-15%, 10%) scale(1.1)';
                circles[2].style.transform = 'translate(-10%, -20%) scale(0.9)';
                break;
            default:
                break;
        }
    }
    
    // Handle wheel scroll navigation
    function handleScroll(event) {
        // Prevent default scrolling behavior
        event.preventDefault();
        
        // If we're already scrolling, return
        if (isScrolling) return;
        
        // Determine scroll direction
        const direction = event.deltaY > 0 ? 1 : -1;
        
        // Calculate the next section index
        let nextIndex = currentSectionIndex + direction;
        
        // Ensure index is within bounds
        if (nextIndex >= sectionIds.length) {
            nextIndex = sectionIds.length - 1;
        } else if (nextIndex < 0) {
            nextIndex = 0;
        }
        
        // If we're already at the target section, do nothing
        if (nextIndex === currentSectionIndex) return;
        
        // Set scrolling flag to true
        isScrolling = true;
        
        // Navigate to the next section
        navigateTo(sectionIds[nextIndex]);
        
        // Hide scroll indicator after first scroll
        if (!hasScrolled) {
            hasScrolled = true;
            hideScrollIndicator();
        }
        
        // Clear any existing timeout
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        // Set a timeout to reset the scrolling flag
        scrollTimeout = setTimeout(() => {
            isScrolling = false;
        }, 800); // Matches the transition duration in CSS
    }
    
    // Add scroll event listener
    document.addEventListener('wheel', handleScroll, { passive: false });
    
    // Add touch swipe support for mobile
    let touchStartY = 0;
    
    document.addEventListener('touchstart', (e) => {
        touchStartY = e.touches[0].clientY;
    }, { passive: true });
    
    document.addEventListener('touchmove', (e) => {
        if (isScrolling) return;
        
        const touchEndY = e.touches[0].clientY;
        const diff = touchStartY - touchEndY;
        
        // Minimum swipe distance (px)
        if (Math.abs(diff) > 50) {
            const direction = diff > 0 ? 1 : -1;
            
            // Calculate the next section index
            let nextIndex = currentSectionIndex + direction;
            
            // Ensure index is within bounds
            if (nextIndex >= sectionIds.length) {
                nextIndex = sectionIds.length - 1;
            } else if (nextIndex < 0) {
                nextIndex = 0;
            }
            
            // If we're already at the target section, do nothing
            if (nextIndex === currentSectionIndex) return;
            
            // Set scrolling flag to true
            isScrolling = true;
            
            // Navigate to the next section
            navigateTo(sectionIds[nextIndex]);
            
            // Hide scroll indicator after first swipe
            if (!hasScrolled) {
                hasScrolled = true;
                hideScrollIndicator();
            }
            
            // Reset touchStartY
            touchStartY = touchEndY;
            
            // Clear any existing timeout
            if (scrollTimeout) {
                clearTimeout(scrollTimeout);
            }
            
            // Set a timeout to reset the scrolling flag
            scrollTimeout = setTimeout(() => {
                isScrolling = false;
            }, 800);
        }
    }, { passive: true });

    // Add click handlers to tab indicators
    tabIndicators.forEach(indicator => {
        indicator.addEventListener('click', () => {
            navigateTo(indicator.dataset.section);
        });
    });

    // Add click handlers to action buttons
    actionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const action = button.dataset.action;
            
            switch(action) {
                case 'showHome':
                    navigateTo('home');
                    break;
                case 'showPage1':
                    navigateTo('page1');
                    break;
                case 'showPage2':
                    navigateTo('page2');
                    break;
                case 'showPage3':
                    navigateTo('page3');
                    break;
                default:
                    break;
            }
        });
    });

    // Add interactive effects on mouse movement
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        
        // Subtle movement for circles
        circles.forEach((circle, index) => {
            const speed = 0.03 + (index * 0.01);
            const baseTransform = circle.style.transform || '';
            
            // Only apply parallax if there's no transition happening (when baseTransform is empty)
            if (!baseTransform.includes('translate')) {
                const offsetX = (0.5 - x) * speed * 100;
                const offsetY = (0.5 - y) * speed * 100;
                circle.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
            }
        });
        
    });

    // Add keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (isScrolling) return;
        
        // Arrow keys for navigation
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            const nextIndex = Math.min(currentSectionIndex + 1, sectionIds.length - 1);
            if (nextIndex !== currentSectionIndex) {
                isScrolling = true;
                navigateTo(sectionIds[nextIndex]);
                
                // Hide scroll indicator after first navigation
                if (!hasScrolled) {
                    hasScrolled = true;
                    hideScrollIndicator();
                }
                
                setTimeout(() => {
                    isScrolling = false;
                }, 800);
            }
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const nextIndex = Math.max(currentSectionIndex - 1, 0);
            if (nextIndex !== currentSectionIndex) {
                isScrolling = true;
                navigateTo(sectionIds[nextIndex]);
                
                // Hide scroll indicator after first navigation
                if (!hasScrolled) {
                    hasScrolled = true;
                    hideScrollIndicator();
                }
                
                setTimeout(() => {
                    isScrolling = false;
                }, 800);
            }
        }
    });
}); 