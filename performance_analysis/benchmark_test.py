"""
Comprehensive Benchmark Test for QSAFE Offline NLP Engine

This script performs detailed benchmarking including:
- Inference latency (single and batch)
- Throughput (queries per second)
- Memory usage analysis
- Concurrent request handling
- Input size scaling
- Tier-specific performance
- Language-specific benchmarks
"""

import pandas as pd
import numpy as np
import time
import psutil
import os
import sys
import json
from pathlib import Path
from typing import Dict, List, Tuple
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from collections import defaultdict

# Add the offline-nlp src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'offline-nlp'))

try:
    from src.engine import IntentEngine, get_engine
    from src.preprocessor import TextPreprocessor
except ImportError as e:
    print(f"Error: Could not import required modules: {e}")
    sys.exit(1)


class NLPEngineBenchmark:
    """Comprehensive benchmarking suite for NLP engine."""
    
    def __init__(self, project_root: Path = None):
        """Initialize benchmark suite."""
        if project_root is None:
            project_root = Path(__file__).parent.parent / 'offline-nlp'
        
        self.project_root = project_root
        self.engine = get_engine(project_root)
        self.preprocessor = TextPreprocessor()
        
        # Benchmark test queries
        self.test_queries = [
            # English
            "earthquake safety protocol",
            "help trapped under debris",
            "first aid for bleeding",
            "emergency contact numbers",
            "flood evacuation guidance",
            # Devanagari
            "भूकम्प सुरक्षा निर्देशिका",
            "भग्नावशेषमुनि थुनिएको",
            "रगत बगेको उपचार",
            "आपतकालीन सम्पर्क नम्बर",
            "बाढी बचाव निर्देशिका",
            # Romanized
            "bhukampa safety protocol",
            "debris muni thuniyo",
            "ragat bageko upchar",
            "aapatkaalin sambark nambar",
            "badi bachav nirdeshika"
        ]
        
    def get_memory_usage(self) -> float:
        """Get current memory usage in MB."""
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / (1024 * 1024)
    
    def benchmark_single_inference(self, num_iterations: int = 1000) -> Dict:
        """Benchmark single query inference latency."""
        print(f"Benchmarking single inference latency ({num_iterations} iterations)...")
        
        latencies = []
        memory_before = self.get_memory_usage()
        
        for _ in range(num_iterations):
            query = self.test_queries[_ % len(self.test_queries)]
            
            start_time = time.perf_counter()
            result = self.engine.predict(query)
            end_time = time.perf_counter()
            
            latencies.append((end_time - start_time) * 1000)  # Convert to ms
        
        memory_after = self.get_memory_usage()
        
        latencies = np.array(latencies)
        
        return {
            'mean_ms': float(np.mean(latencies)),
            'median_ms': float(np.median(latencies)),
            'std_ms': float(np.std(latencies)),
            'min_ms': float(np.min(latencies)),
            'max_ms': float(np.max(latencies)),
            'p95_ms': float(np.percentile(latencies, 95)),
            'p99_ms': float(np.percentile(latencies, 99)),
            'total_memory_mb': memory_after - memory_before,
            'iterations': num_iterations
        }
    
    def benchmark_batch_inference(self, batch_sizes: List[int] = [1, 10, 50, 100, 500]) -> Dict:
        """Benchmark batch inference performance."""
        print("Benchmarking batch inference performance...")
        
        results = {}
        
        for batch_size in batch_sizes:
            print(f"  Testing batch size: {batch_size}")
            
            # Create batch of queries
            batch_queries = [self.test_queries[i % len(self.test_queries)] 
                           for i in range(batch_size)]
            
            # Measure batch inference time
            start_time = time.perf_counter()
            batch_results = [self.engine.predict(q) for q in batch_queries]
            end_time = time.perf_counter()
            
            total_time = end_time - start_time
            avg_time_per_query = (total_time / batch_size) * 1000  # ms
            throughput = batch_size / total_time  # queries per second
            
            results[batch_size] = {
                'total_time_seconds': total_time,
                'avg_time_per_query_ms': avg_time_per_query,
                'throughput_qps': throughput
            }
        
        return results
    
    def benchmark_throughput(self, duration_seconds: int = 10) -> Dict:
        """Benchmark maximum throughput over sustained period."""
        print(f"Benchmarking sustained throughput ({duration_seconds} seconds)...")
        
        query_count = 0
        start_time = time.time()
        end_time = start_time + duration_seconds
        
        while time.time() < end_time:
            query = self.test_queries[query_count % len(self.test_queries)]
            self.engine.predict(query)
            query_count += 1
        
        actual_duration = time.time() - start_time
        throughput = query_count / actual_duration
        
        return {
            'total_queries': query_count,
            'duration_seconds': actual_duration,
            'throughput_qps': throughput,
            'avg_latency_ms': (actual_duration / query_count) * 1000
        }
    
    def benchmark_concurrent_requests(self, num_threads: int = 10, requests_per_thread: int = 100) -> Dict:
        """Benchmark concurrent request handling."""
        print(f"Benchmarking concurrent requests ({num_threads} threads, {requests_per_thread} requests each)...")
        
        def worker(thread_id: int) -> List[float]:
            """Worker function for concurrent requests."""
            latencies = []
            for i in range(requests_per_thread):
                query = self.test_queries[(thread_id * requests_per_thread + i) % len(self.test_queries)]
                
                start_time = time.perf_counter()
                self.engine.predict(query)
                end_time = time.perf_counter()
                
                latencies.append((end_time - start_time) * 1000)
            
            return latencies
        
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker, i) for i in range(num_threads)]
            all_latencies = []
            
            for future in as_completed(futures):
                all_latencies.extend(future.result())
        
        total_time = time.time() - start_time
        total_requests = num_threads * requests_per_thread
        
        all_latencies = np.array(all_latencies)
        
        return {
            'total_requests': total_requests,
            'total_time_seconds': total_time,
            'throughput_qps': total_requests / total_time,
            'mean_latency_ms': float(np.mean(all_latencies)),
            'median_latency_ms': float(np.median(all_latencies)),
            'p95_latency_ms': float(np.percentile(all_latencies, 95)),
            'p99_latency_ms': float(np.percentile(all_latencies, 99))
        }
    
    def benchmark_input_size_scaling(self) -> Dict:
        """Benchmark performance with different input sizes."""
        print("Benchmarking input size scaling...")
        
        # Generate queries of different lengths
        size_tests = {
            'short': 'help',
            'medium': 'earthquake safety protocol for buildings',
            'long': 'earthquake safety protocol for multi-story buildings with detailed evacuation procedures and emergency contact information for disaster management',
            'very_long': 'earthquake safety protocol for multi-story buildings with detailed evacuation procedures and emergency contact information for disaster management including first aid guidelines for trapped victims and structural damage assessment protocols for emergency responders'
        }
        
        results = {}
        for size_name, query in size_tests.items():
            print(f"  Testing {size_name} input ({len(query)} characters)...")
            
            latencies = []
            for _ in range(100):
                start_time = time.perf_counter()
                self.engine.predict(query)
                end_time = time.perf_counter()
                latencies.append((end_time - start_time) * 1000)
            
            latencies = np.array(latencies)
            results[size_name] = {
                'input_length': len(query),
                'mean_latency_ms': float(np.mean(latencies)),
                'median_latency_ms': float(np.median(latencies)),
                'std_latency_ms': float(np.std(latencies))
            }
        
        return results
    
    def benchmark_tier_performance(self) -> Dict:
        """Benchmark performance by inference tier."""
        print("Benchmarking tier-specific performance...")
        
        # Queries designed to hit different tiers
        tier_queries = {
            'keyword': ['namaste', 'help', 'sos'],
            'fuzzy': ['namastee', 'hellp', 'esos'],
            'ml': ['earthquake safety protocol', 'trapped under debris', 'first aid bleeding']
        }
        
        results = {}
        for tier, queries in tier_queries.items():
            print(f"  Testing {tier} tier...")
            
            latencies = []
            sources = []
            
            for query in queries:
                for _ in range(50):
                    start_time = time.perf_counter()
                    result = self.engine.predict(query)
                    end_time = time.perf_counter()
                    
                    latencies.append((end_time - start_time) * 1000)
                    sources.append(result['source'])
            
            latencies = np.array(latencies)
            source_counts = defaultdict(int)
            for source in sources:
                source_counts[source] += 1
            
            results[tier] = {
                'mean_latency_ms': float(np.mean(latencies)),
                'median_latency_ms': float(np.median(latencies)),
                'std_latency_ms': float(np.std(latencies)),
                'actual_sources': dict(source_counts)
            }
        
        return results
    
    def benchmark_language_performance(self) -> Dict:
        """Benchmark performance by language."""
        print("Benchmarking language-specific performance...")
        
        language_queries = {
            'english': ['earthquake safety', 'help trapped', 'first aid'],
            'devanagari': ['भूकम्प सुरक्षा', 'मद्दत', 'प्राथमिक उपचार'],
            'romanized': ['bhukampa safety', 'madat', 'prathamik upchar']
        }
        
        results = {}
        for lang, queries in language_queries.items():
            print(f"  Testing {lang}...")
            
            latencies = []
            for query in queries:
                for _ in range(100):
                    start_time = time.perf_counter()
                    self.engine.predict(query)
                    end_time = time.perf_counter()
                    latencies.append((end_time - start_time) * 1000)
            
            latencies = np.array(latencies)
            results[lang] = {
                'mean_latency_ms': float(np.mean(latencies)),
                'median_latency_ms': float(np.median(latencies)),
                'std_latency_ms': float(np.std(latencies))
            }
        
        return results
    
    def benchmark_memory_usage(self) -> Dict:
        """Benchmark memory usage characteristics."""
        print("Benchmarking memory usage...")
        
        # Initial memory
        initial_memory = self.get_memory_usage()
        
        # Load engine (already loaded, but measure steady state)
        steady_state_memory = self.get_memory_usage()
        
        # Perform many inferences to check for memory leaks
        print("  Running 10,000 inferences to check for memory leaks...")
        for i in range(10000):
            query = self.test_queries[i % len(self.test_queries)]
            self.engine.predict(query)
        
        final_memory = self.get_memory_usage()
        memory_growth = final_memory - steady_state_memory
        
        return {
            'initial_memory_mb': initial_memory,
            'steady_state_memory_mb': steady_state_memory,
            'final_memory_mb': final_memory,
            'memory_growth_mb': memory_growth,
            'memory_per_inference_kb': (memory_growth * 1024) / 10000 if memory_growth > 0 else 0
        }
    
    def run_comprehensive_benchmark(self) -> Dict:
        """Run all benchmark tests."""
        print("="*60)
        print("QSAFE NLP COMPREHENSIVE BENCHMARK SUITE")
        print("="*60)
        
        benchmark_results = {
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'system_info': {
                'cpu_count': psutil.cpu_count(),
                'memory_total_gb': psutil.virtual_memory().total / (1024**3),
                'python_version': sys.version
            }
        }
        
        # Run all benchmarks
        benchmark_results['single_inference'] = self.benchmark_single_inference(1000)
        benchmark_results['batch_inference'] = self.benchmark_batch_inference([1, 10, 50, 100, 500])
        benchmark_results['throughput'] = self.benchmark_throughput(10)
        benchmark_results['concurrent_requests'] = self.benchmark_concurrent_requests(10, 100)
        benchmark_results['input_size_scaling'] = self.benchmark_input_size_scaling()
        benchmark_results['tier_performance'] = self.benchmark_tier_performance()
        benchmark_results['language_performance'] = self.benchmark_language_performance()
        benchmark_results['memory_usage'] = self.benchmark_memory_usage()
        
        return benchmark_results
    
    def save_benchmark_results(self, results: Dict, output_path: str = 'benchmark_results.json'):
        """Save benchmark results to JSON file."""
        output_file = Path(__file__).parent / output_path
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, indent=2)
        print(f"💾 Benchmark results saved to {output_file}")
    
    def print_benchmark_summary(self, results: Dict):
        """Print human-readable benchmark summary."""
        print("\n" + "="*60)
        print("BENCHMARK RESULTS SUMMARY")
        print("="*60)
        
        print("\n--- Single Inference Latency ---")
        single = results['single_inference']
        print(f"Mean: {single['mean_ms']:.3f} ms")
        print(f"Median: {single['median_ms']:.3f} ms")
        print(f"P95: {single['p95_ms']:.3f} ms")
        print(f"P99: {single['p99_ms']:.3f} ms")
        
        print("\n--- Throughput ---")
        throughput = results['throughput']
        print(f"Sustained Throughput: {throughput['throughput_qps']:.1f} queries/sec")
        print(f"Average Latency: {throughput['avg_latency_ms']:.3f} ms")
        
        print("\n--- Concurrent Requests ---")
        concurrent = results['concurrent_requests']
        print(f"Throughput: {concurrent['throughput_qps']:.1f} queries/sec")
        print(f"P95 Latency: {concurrent['p95_latency_ms']:.3f} ms")
        print(f"P99 Latency: {concurrent['p99_latency_ms']:.3f} ms")
        
        print("\n--- Batch Performance ---")
        for batch_size, metrics in results['batch_inference'].items():
            print(f"Batch {batch_size}: {metrics['throughput_qps']:.1f} qps, {metrics['avg_time_per_query_ms']:.3f} ms/query")
        
        print("\n--- Memory Usage ---")
        memory = results['memory_usage']
        print(f"Steady State: {memory['steady_state_memory_mb']:.2f} MB")
        print(f"Memory Growth (10k inferences): {memory['memory_growth_mb']:.2f} MB")
        print(f"Per Inference: {memory['memory_per_inference_kb']:.2f} KB")
        
        print("\n--- Tier Performance ---")
        for tier, metrics in results['tier_performance'].items():
            print(f"{tier}: {metrics['mean_latency_ms']:.3f} ms")
        
        print("\n--- Language Performance ---")
        for lang, metrics in results['language_performance'].items():
            print(f"{lang}: {metrics['mean_latency_ms']:.3f} ms")
        
        print("="*60)


def main():
    """Main entry point for benchmark testing."""
    benchmark = NLPEngineBenchmark()
    
    # Run comprehensive benchmark
    results = benchmark.run_comprehensive_benchmark()
    
    # Save results
    benchmark.save_benchmark_results(results)
    
    # Print summary
    benchmark.print_benchmark_summary(results)
    
    print("\n✅ Benchmark testing complete!")


if __name__ == '__main__':
    main()
