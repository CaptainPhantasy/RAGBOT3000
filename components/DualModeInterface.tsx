import React, { useState, useEffect, useCallback } from 'react';
import { WebAnalyzer } from '../services/webAnalyzer';
import { getMemoryManager, type MemoryFile } from '../memory/memoryManager';
import { llmInterface } from '../services/llmInterface';

type InteractionMode = 'human' | 'llm' | 'dual';

export const DualModeInterface: React.FC = () => {
  const [mode, setMode] = useState<InteractionMode>('dual');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  const [llmResponse, setLlmResponse] = useState<string>('');
  const [humanQuery, setHumanQuery] = useState<string>('');
  const [llmCommand, setLlmCommand] = useState<string>('');
  const [memory, setMemory] = useState<MemoryFile | null>(null);
  const [verboseOutput, setVerboseOutput] = useState<boolean>(true);
  
  const memoryManager = getMemoryManager();
  const webAnalyzer = new WebAnalyzer();
  
  // Subscribe to memory updates
  useEffect(() => {
    const unsubscribe = memoryManager.subscribe(setMemory);
    return unsubscribe;
  }, []);
  
  // Auto-analyze on page load
  useEffect(() => {
    const autoAnalyze = async () => {
      setIsAnalyzing(true);
      try {
        const results = await webAnalyzer.analyzeCurrentPage();
        setAnalysisResults(results);
      } catch (error) {
        console.error('Analysis failed:', error);
      } finally {
        setIsAnalyzing(false);
      }
    };
    
    autoAnalyze();
  }, []);
  
  // Handle human query
  const handleHumanQuery = useCallback(async () => {
    if (!humanQuery.trim()) return;
    
    // In a real implementation, this would send to a chat service
    // For now, we'll simulate a response based on the analysis
    const response = generateHumanResponse(humanQuery, analysisResults);
    setLlmResponse(response);
    setHumanQuery('');
  }, [humanQuery, analysisResults]);
  
  // Handle LLM command
  const handleLlmCommand = useCallback(async () => {
    if (!llmCommand.trim()) return;
    
    setIsAnalyzing(true);
    try {
      const result = await llmInterface.sendCommand(llmCommand);
      setLlmResponse(result);
      setLlmCommand('');
      
      // Re-analyze after command execution
      setTimeout(async () => {
        const newResults = await webAnalyzer.analyzeCurrentPage();
        setAnalysisResults(newResults);
        setIsAnalyzing(false);
      }, 1000);
    } catch (error) {
      setLlmResponse(`Error: ${error}`);
      setIsAnalyzing(false);
    }
  }, [llmCommand]);
  
  // Get observations for LLM
  const getObservationsForLLM = useCallback(async () => {
    const verbosity = verboseOutput ? 'verbose' : 'standard';
    return await llmInterface.getLatestObservations(verbosity);
  }, [verboseOutput]);
  
  // Generate human-friendly response
  const generateHumanResponse = (query: string, analysis: any): string => {
    if (!analysis) return "No analysis available yet.";
    
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('accessibility') || lowerQuery.includes('wcag')) {
      const violations = analysis.accessibility.wcag_compliance.violations.length;
      const level = analysis.accessibility.wcag_compliance.level;
      return `This page has WCAG ${level} compliance with ${violations} violations. ${violations > 0 ? 'The main issues are: ' + analysis.accessibility.wcag_compliance.violations.slice(0, 3).map((v: any) => v.description).join(', ') : 'Great job! No major accessibility issues detected.'}`;
    }
    
    if (lowerQuery.includes('css') || lowerQuery.includes('style')) {
      const cssIssues = analysis.css_analysis.potential_issues.performance_impact.length;
      return `I found ${cssIssues} CSS performance issues. The layout uses ${analysis.css_analysis.layout_systems.flexbox.containers.length} flexbox containers and ${analysis.css_analysis.layout_systems.grid.containers.length} grid containers.`;
    }
    
    if (lowerQuery.includes('error') || lowerQuery.includes('issue')) {
      const criticalIssues = analysis.summary.critical_issues.length;
      if (criticalIssues > 0) {
        return `Found ${criticalIssues} critical issues:\n${analysis.summary.critical_issues.map((issue: string) => `• ${issue}`).join('\n')}`;
      }
      return "No critical issues found on this page.";
    }
    
    // Default response
    return `This page scored ${analysis.summary.overall_score}/100. ${analysis.summary.positive_aspects.join('. ')}. ${analysis.summary.recommended_fixes.length > 0 ? 'Consider these improvements: ' + analysis.summary.recommended_fixes.slice(0, 2).map(f => f.issue).join(', ') : ''}`;
  };
  
  // Export memory for external LLM consumption
  const exportForLLM = async () => {
    const data = await getObservationsForLLM();
    // Copy to clipboard or download
    navigator.clipboard.writeText(data);
    alert('Observations copied to clipboard for LLM consumption');
  };
  
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">RAGBOT Web Analyzer</h1>
        
        {/* Mode Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Interaction Mode</label>
          <div className="flex space-x-4">
            <button
              onClick={() => setMode('human')}
              className={`px-4 py-2 rounded ${mode === 'human' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Human Chat
            </button>
            <button
              onClick={() => setMode('llm')}
              className={`px-4 py-2 rounded ${mode === 'llm' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              LLM Commands
            </button>
            <button
              onClick={() => setMode('dual')}
              className={`px-4 py-2 rounded ${mode === 'dual' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Dual Mode
            </button>
          </div>
        </div>
        
        {/* Analysis Status */}
        <div className="mb-6 p-4 bg-gray-100 rounded">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Page Analysis</span>
            {isAnalyzing ? (
              <span className="text-yellow-600">Analyzing...</span>
            ) : analysisResults ? (
              <span className="text-green-600">Complete (Score: {analysisResults.summary.overall_score}/100)</span>
            ) : (
              <span className="text-gray-600">Not analyzed</span>
            )}
          </div>
          
          {/* Quick Stats */}
          {analysisResults && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium">WCAG Level:</span> {analysisResults.accessibility.wcag_compliance.level}
              </div>
              <div>
                <span className="font-medium">Issues:</span> {analysisResults.summary.critical_issues.length}
              </div>
              <div>
                <span className="font-medium">Layout:</span> {analysisResults.layout.navigation_elements.length} nav elements
              </div>
              <div>
                <span className="font-medium">CSS Issues:</span> {analysisResults.css_analysis.potential_issues.performance_impact.length}
              </div>
            </div>
          )}
        </div>
        
        {/* Human Interface */}
        {(mode === 'human' || mode === 'dual') && (
          <div className="mb-6 p-4 bg-blue-50 rounded">
            <h3 className="text-lg font-semibold mb-3">Human Interface</h3>
            <div className="flex space-x-2">
              <input
                type="text"
                value={humanQuery}
                onChange={(e) => setHumanQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleHumanQuery()}
                placeholder="Ask about accessibility, CSS, errors, etc."
                className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleHumanQuery}
                disabled={!humanQuery.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
              >
                Ask
              </button>
            </div>
            
            <div className="mt-3 flex space-x-2">
              <button
                onClick={() => setVerboseOutput(!verboseOutput)}
                className={`px-3 py-1 text-sm rounded ${verboseOutput ? 'bg-blue-200' : 'bg-gray-200'}`}
              >
                {verboseOutput ? 'Verbose' : 'Standard'}
              </button>
              <button
                onClick={exportForLLM}
                className="px-3 py-1 text-sm bg-green-200 rounded hover:bg-green-300"
              >
                Export for LLM
              </button>
            </div>
          </div>
        )}
        
        {/* LLM Interface */}
        {(mode === 'llm' || mode === 'dual') && (
          <div className="mb-6 p-4 bg-purple-50 rounded">
            <h3 className="text-lg font-semibold mb-3">LLM Command Interface</h3>
            <div className="flex space-x-2">
              <input
                type="text"
                value={llmCommand}
                onChange={(e) => setLlmCommand(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleLlmCommand()}
                placeholder="Enter LLM command (e.g., click_element #submit)"
                className="flex-1 px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleLlmCommand}
                disabled={!llmCommand.trim() || isAnalyzing}
                className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:bg-gray-300"
              >
                Execute
              </button>
            </div>
            
            <div className="mt-3 text-sm text-gray-600">
              <strong>Available commands:</strong> click_element, navigate, extract_text, 
              get_element_property, wait_for_element, scroll_to_element, analyze_element
            </div>
            
            {/* API Endpoints Info */}
            <div className="mt-3 p-2 bg-purple-100 rounded text-xs">
              <div>GET /observations?verbosity=verbose</div>
              <div>POST /command</div>
              <div>GET /memory</div>
              <div>GET /status</div>
            </div>
          </div>
        )}
        
        {/* Response Area */}
        {llmResponse && (
          <div className="mb-6 p-4 bg-gray-50 rounded">
            <h3 className="text-lg font-semibold mb-2">Response</h3>
            <pre className="whitespace-pre-wrap text-sm bg-white p-3 rounded border overflow-auto max-h-64">
              {llmResponse}
            </pre>
          </div>
        )}
        
        {/* Memory Status */}
        {memory && (
          <div className="text-xs text-gray-500">
            Session: {memory.session_id} | 
            Observations: {memory.observations.length} | 
            Last Updated: {new Date(memory.last_updated).toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  );
};