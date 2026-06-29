// Set current year in footer
document.getElementById('year').textContent = new Date().getFullYear();

// Download tracking — count how many times the download buttons are clicked
let downloadCount = 0;
const downloadBtns = document.querySelectorAll('[download]');

function trackDownload() {
  downloadCount++;
  console.log(`Download initiated (${downloadCount} total)`);
  // Can be extended to send analytics event
}

downloadBtns.forEach(btn => {
  btn.addEventListener('click', trackDownload);
});

// Smooth reveal for feature cards on scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.feature-card').forEach((card, i) => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(20px)';
  card.style.transition = `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`;
  observer.observe(card);
});
