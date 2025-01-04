const API_KEY = 'AIzaSyB80eaehLMopcJHF8Zv8rf4hmdf1j9nbLE';
        
const dragArea = document.getElementById('dragArea');
const fileInput = document.getElementById('fileInput');
const previewArea = document.getElementById('previewArea');
const imagePreview = document.getElementById('imagePreview');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultArea = document.getElementById('resultArea');
const pestInfo = document.getElementById('pestInfo');

async function detectPests(imageFile) {
    try {
        const base64Image = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(imageFile);
        });

        const requestBody = {
            contents: [{
                parts: [
                    {
                        text: "Analyze this plant image and identify if there are any pests. If you see pests, provide the following information in this exact format:\n\nPest Name: [pest name]\nDescription: [description]\nSeverity Level: (Low/Moderate/High)\nRecommended Treatment:\n- [treatment step 1]\n- [treatment step 2]\n- [treatment step 3]\n\nIf you don't see any pests, respond with 'No pests detected' and explain what you see in the image."
                    },
                    {
                        inline_data: {
                            mime_type: imageFile.type,
                            data: base64Image
                        }
                    }
                ]
            }]
        };

        console.log('Sending request to Gemini API...');
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error:', response.status, errorText);
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('API Response:', data);

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid response format from API');
        }

        const resultText = data.candidates[0].content.parts[0].text;
        console.log('Result text:', resultText);

        // Check if no pests were detected
        if (resultText.includes('No pests detected')) {
            return {
                pest: 'None',
                description: resultText,
                severity: 'None',
                treatment: ['No treatment needed']
            };
        }

        // Parse the text response with improved section separation
        const sections = resultText.split('\n');
        let result = {
            pest: 'Unknown',
            description: '',
            severity: 'Unknown',
            treatment: []
        };

        let currentSection = '';

        for (let i = 0; i < sections.length; i++) {
            const line = sections[i].trim();
            
            if (line.toLowerCase().startsWith('pest name:')) {
                result.pest = line.split(':')[1]?.trim() || 'Unknown';
            }
            else if (line.toLowerCase().startsWith('description:')) {
                result.description = line.split(':')[1]?.trim() || '';
                // Continue adding lines to description until hit the next section
                let nextIndex = i + 1;
                while (nextIndex < sections.length && 
                       !sections[nextIndex].toLowerCase().includes('severity') &&
                       !sections[nextIndex].toLowerCase().includes('treatment')) {
                    const nextLine = sections[nextIndex].trim();
                    if (nextLine && !nextLine.includes(':')) {
                        result.description += ' ' + nextLine;
                    }
                    nextIndex++;
                }
            }
            else if (line.toLowerCase().includes('severity')) {
                const severityMatch = line.split(':')[1]?.trim().toLowerCase() || '';
                if (severityMatch.includes('low')) {
                    result.severity = 'Low';
                } else if (severityMatch.includes('moderate')) {
                    result.severity = 'Moderate';
                } else if (severityMatch.includes('high')) {
                    result.severity = 'High';
                } else {
                    result.severity = 'Unknown';
                }
            }
            else if (line.toLowerCase().includes('treatment:')) {
                currentSection = 'treatment';
            }
            else if (currentSection === 'treatment' && line.trim()) {
                // Clean up the treatment line
                let treatment = line.trim();
                if (treatment.startsWith('-')) {
                    treatment = treatment.substring(1).trim();
                }
                if (treatment && !treatment.toLowerCase().includes('severity')) {
                    result.treatment.push(treatment);
                }
            }
        }

        // Ensure at least one treatment
        if (result.treatment.length === 0) {
            result.treatment = ['No specific treatment provided'];
        }

        console.log('Parsed result:', result);
        return result;
    } catch (error) {
        console.error('Full error details:', error);
        throw new Error(`Analysis failed: ${error.message}`);
    }
}

function displayResults(result) {
    try {
        if (result.pest === 'None') {
            pestInfo.innerHTML = `
                <div>
                    <p>No pests detected</p>
                    <p>${result.description}</p>
                </div>
            `;
            return;
        }

        // Determine severity color, not working
        let severityColor = 'gray';
        if (result.severity.toLowerCase() === 'low') {
            severityColor = 'yellow';
        } else if (result.severity.toLowerCase() === 'moderate') {
            severityColor = 'orange';
        } else if (result.severity.toLowerCase() === 'high') {
            severityColor = 'red';
        }

        pestInfo.innerHTML = `
            <div">
                <p>Detected Pest: ${result.pest || 'Unknown'}</p>
                <p>
                    <span class="${severityColor}">
                        Severity: ${result.severity || 'Unknown'}
                    </span>
                </p>
            </div>
            <div>
                <p>${result.description || 'No description available'}</p>
                <div>
                    <p>Recommended Treatment:</p>
                    <ul>
                        ${result.treatment.map(t => `<li>${t}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error displaying results:', error);
        pestInfo.innerHTML = `
            <div>
                Error displaying results. Please try again.
            </div>
        `;
    }
}

fileInput.addEventListener('change', handleFile);

dragArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dragArea.classList.add('dragover');
});

dragArea.addEventListener('dragleave', () => {
    dragArea.classList.remove('dragover');
});

dragArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dragArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleFile({ target: { files: [file] } });
    }
});

async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        imagePreview.src = e.target.result;
        dragArea.classList.add('hidden');
        previewArea.classList.remove('hidden');
        loadingIndicator.classList.remove('hidden');
        resultArea.classList.add('hidden');

        try {
            const result = await detectPests(file);
            displayResults(result);
        } catch (error) {
            console.error('Error in handleFile:', error);
            pestInfo.innerHTML = `
                <div>
                    ${error.message}
                </div>
            `;
        }

        loadingIndicator.classList.add('hidden');
        resultArea.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function resetUpload() {
    dragArea.classList.remove('hidden');
    previewArea.classList.add('hidden');
    fileInput.value = '';
    imagePreview.src = '';
    pestInfo.innerHTML = '';
    document.getElementById('dragArea').classList.remove('hidden');
}
document.getElementById('fileInput').addEventListener('change', function() {
    document.getElementById('dragArea').classList.add('hidden');
  });